import { Client } from 'ssh2'
import { promises as fs } from 'fs'

/**
 * Runs a runbook's commands as one shell script over a direct SSH
 * connection — the 'ssh' project type's equivalent of ssmService.runAndWait,
 * returning the same {status, output, error} shape so the UI doesn't need
 * to care which transport actually ran the commands.
 */
export async function runOverSsh({ host, port = 22, username, privateKeyPath, passphrase, commands }) {
  const privateKey = await fs.readFile(privateKeyPath, 'utf-8')
  const script = commands.join('\n')

  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn
      .on('ready', () => {
        conn.exec(script, (err, stream) => {
          if (err) {
            conn.end()
            reject(err)
            return
          }
          let stdout = ''
          let stderr = ''
          stream
            .on('close', (exitCode) => {
              conn.end()
              resolve({
                status: exitCode === 0 ? 'Success' : 'Failed',
                output: stdout,
                error: stderr
              })
            })
            .on('data', (data) => {
              stdout += data.toString()
            })
            .stderr.on('data', (data) => {
              stderr += data.toString()
            })
        })
      })
      .on('error', (err) => reject(err))
      .connect({ host, port, username, privateKey, passphrase, readyTimeout: 15000 })
  })
}
