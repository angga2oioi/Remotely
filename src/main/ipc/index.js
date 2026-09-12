import { registerProjectHandlers } from './projectHandlers.js'
import { registerRunbookHandlers } from './runbookHandlers.js'
import { registerEc2Handlers } from './ec2Handlers.js'
import { registerSsmHandlers } from './ssmHandlers.js'
import { registerInstanceTagHandlers } from './instanceTagHandlers.js'
import { registerSshHandlers } from './sshHandlers.js'
import { registerAgentHandlers } from './agentHandlers.js'
import { registerBackupHandlers } from './backupHandlers.js'

export function registerIpcHandlers() {
  registerProjectHandlers()
  registerRunbookHandlers()
  registerEc2Handlers()
  registerSsmHandlers()
  registerInstanceTagHandlers()
  registerSshHandlers()
  registerAgentHandlers()
  registerBackupHandlers()
}
