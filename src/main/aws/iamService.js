import {
  IAMClient,
  GetInstanceProfileCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  CreateInstanceProfileCommand,
  AddRoleToInstanceProfileCommand
} from '@aws-sdk/client-iam'
import { EC2Client, AssociateIamInstanceProfileCommand } from '@aws-sdk/client-ec2'
import { resolveAwsConfig } from './clientFactory.js'

const PROFILE_NAME = 'RemotelySsmInstanceRole'
const SSM_MANAGED_POLICY_ARN = 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
const TRUST_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [{ Effect: 'Allow', Principal: { Service: 'ec2.amazonaws.com' }, Action: 'sts:AssumeRole' }]
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** IAM has no region concept for these calls, but the SDK client still needs one. */
async function iamClientFor(projectId) {
  const config = await resolveAwsConfig(projectId)
  return new IAMClient(config)
}

async function ensureInstanceProfile(iam) {
  try {
    const existing = await iam.send(new GetInstanceProfileCommand({ InstanceProfileName: PROFILE_NAME }))
    return existing.InstanceProfile.Arn
  } catch (err) {
    if (err.name !== 'NoSuchEntityException') throw err
  }

  try {
    await iam.send(
      new CreateRoleCommand({
        RoleName: PROFILE_NAME,
        AssumeRolePolicyDocument: TRUST_POLICY,
        Description: 'Created by Remotely so EC2 instances can register with AWS Systems Manager.'
      })
    )
  } catch (err) {
    if (err.name !== 'EntityAlreadyExistsException') throw err
  }

  await iam.send(new AttachRolePolicyCommand({ RoleName: PROFILE_NAME, PolicyArn: SSM_MANAGED_POLICY_ARN }))

  const created = await iam.send(new CreateInstanceProfileCommand({ InstanceProfileName: PROFILE_NAME }))

  try {
    await iam.send(new AddRoleToInstanceProfileCommand({ InstanceProfileName: PROFILE_NAME, RoleName: PROFILE_NAME }))
  } catch (err) {
    if (err.name !== 'LimitExceededException') throw err // role already added to this profile
  }

  return created.InstanceProfile.Arn
}

export const iamService = {
  /**
   * Finds (or creates) a role+instance profile with AmazonSSMManagedInstanceCore
   * and attaches it to the given instance. A freshly created IAM role is not
   * immediately usable by EC2 (eventual consistency), so the attach step
   * retries for up to ~30s before giving up.
   */
  async attachSsmRole(projectId, instanceId) {
    const iam = await iamClientFor(projectId)
    const instanceProfileArn = await ensureInstanceProfile(iam)

    const config = await resolveAwsConfig(projectId)
    const ec2 = new EC2Client(config)

    const attempts = 6
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await ec2.send(
          new AssociateIamInstanceProfileCommand({
            IamInstanceProfile: { Arn: instanceProfileArn },
            InstanceId: instanceId
          })
        )
        return { roleName: PROFILE_NAME, instanceProfileArn }
      } catch (err) {
        const isEventualConsistency = err.name === 'InvalidParameterValue' && attempt < attempts
        if (!isEventualConsistency) throw err
        await sleep(5000)
      }
    }
    throw new Error('Timed out waiting for the newly created IAM role to become usable. Try again in a moment.')
  }
}
