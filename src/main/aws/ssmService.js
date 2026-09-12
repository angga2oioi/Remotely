import {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand,
  DescribeInstanceInformationCommand
} from '@aws-sdk/client-ssm'
import { resolveAwsConfig } from './clientFactory.js'

const TERMINAL_STATUSES = new Set(['Success', 'Failed', 'Cancelled', 'TimedOut'])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs a runbook (a saved shell command sequence) against one instance via
 * SSM Run Command and polls until it finishes — no SSH/PEM key required.
 */
export const ssmService = {
  /**
   * Instance ids SSM considers online and reachable for Run Command — an
   * EC2 instance can be "running" but not registered here (no SSM Agent, no
   * instance IAM profile, or no network path to the SSM endpoints), in
   * which case SendCommand fails with InvalidInstanceId.
   */
  async listManagedInstanceIds(projectId) {
    const config = await resolveAwsConfig(projectId)
    const client = new SSMClient(config)
    const managed = new Set()
    let nextToken

    do {
      const result = await client.send(
        new DescribeInstanceInformationCommand({ NextToken: nextToken })
      )
      for (const info of result.InstanceInformationList ?? []) {
        if (info.PingStatus === 'Online') managed.add(info.InstanceId)
      }
      nextToken = result.NextToken
    } while (nextToken)

    return [...managed]
  },

  async runAndWait(projectId, { instanceId, commands, comment }, { intervalMs = 1500, timeoutMs = 45000 } = {}) {
    const config = await resolveAwsConfig(projectId)
    const client = new SSMClient(config)

    const sendResult = await client.send(
      new SendCommandCommand({
        InstanceIds: [instanceId],
        DocumentName: 'AWS-RunShellScript',
        Comment: comment,
        Parameters: { commands }
      })
    )
    const commandId = sendResult.Command?.CommandId

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await sleep(intervalMs)
      try {
        const invocation = await client.send(
          new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId })
        )
        if (TERMINAL_STATUSES.has(invocation.Status)) {
          return {
            commandId,
            status: invocation.Status,
            output: invocation.StandardOutputContent,
            error: invocation.StandardErrorContent
          }
        }
      } catch (err) {
        // The invocation record can take a moment to appear after SendCommand.
        if (err.name !== 'InvocationDoesNotExist') throw err
      }
    }

    return {
      commandId,
      status: 'Timeout',
      output: '',
      error: 'Command did not reach a terminal state within the timeout window.'
    }
  }
}
