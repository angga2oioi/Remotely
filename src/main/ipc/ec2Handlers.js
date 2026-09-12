import { ipcMain } from 'electron'
import { ec2Service } from '../aws/ec2Service.js'
import { iamService } from '../aws/iamService.js'

export function registerEc2Handlers() {
  ipcMain.handle('ec2:listInstances', (_event, projectId) => ec2Service.listInstances(projectId))

  ipcMain.handle('ec2:startInstance', (_event, projectId, instanceId) =>
    ec2Service.startInstance(projectId, instanceId)
  )

  ipcMain.handle('ec2:stopInstance', (_event, projectId, instanceId) =>
    ec2Service.stopInstance(projectId, instanceId)
  )

  ipcMain.handle('ec2:attachSsmRole', (_event, projectId, instanceId) =>
    iamService.attachSsmRole(projectId, instanceId)
  )
}
