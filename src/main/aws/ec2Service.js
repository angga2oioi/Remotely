import { EC2Client, DescribeInstancesCommand, StartInstancesCommand, StopInstancesCommand } from '@aws-sdk/client-ec2'
import { resolveAwsConfig } from './clientFactory.js'

function flattenInstances(reservations = []) {
  return reservations.flatMap((reservation) =>
    (reservation.Instances || []).map((instance) => ({
      id: instance.InstanceId,
      type: instance.InstanceType,
      state: instance.State?.Name,
      publicIp: instance.PublicIpAddress,
      privateIp: instance.PrivateIpAddress,
      name: instance.Tags?.find((tag) => tag.Key === 'Name')?.Value ?? null,
      tags: instance.Tags ?? [],
      iamInstanceProfileArn: instance.IamInstanceProfile?.Arn ?? null
    }))
  )
}

export const ec2Service = {
  async listInstances(projectId) {
    const config = await resolveAwsConfig(projectId)
    const client = new EC2Client(config)
    const result = await client.send(new DescribeInstancesCommand({}))
    return flattenInstances(result.Reservations)
  },

  async startInstance(projectId, instanceId) {
    const config = await resolveAwsConfig(projectId)
    const client = new EC2Client(config)
    return client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }))
  },

  async stopInstance(projectId, instanceId) {
    const config = await resolveAwsConfig(projectId)
    const client = new EC2Client(config)
    return client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }))
  }
}
