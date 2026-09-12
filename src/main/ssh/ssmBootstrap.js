import { Client } from 'ssh2'
import { promises as fs } from 'fs'

// Best-effort across the common AWS AMI families. sudo runs with -n
// (non-interactive) so a password prompt fails fast instead of hanging the
// SSH session forever. Region is read from IMDSv2 for the RHEL branch's
// download URL, since the target instance knows its own region.
const BOOTSTRAP_SCRIPT = `
set -e
if [ -r /etc/os-release ]; then . /etc/os-release; else ID=unknown; fi

if command -v amazon-ssm-agent >/dev/null 2>&1 || (command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^amazon-ssm-agent'); then
  echo "SSM Agent already installed."
else
  echo "Installing SSM Agent for detected distro: \${ID:-unknown}"
  case "$ID" in
    amzn)
      sudo -n yum install -y amazon-ssm-agent
      ;;
    ubuntu|debian)
      if command -v snap >/dev/null 2>&1; then
        sudo -n snap install amazon-ssm-agent --classic
      else
        sudo -n apt-get update -y && sudo -n apt-get install -y amazon-ssm-agent
      fi
      ;;
    rhel|centos|rocky|almalinux|fedora)
      TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
      REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
      sudo -n yum install -y "https://s3.\${REGION}.amazonaws.com/amazon-ssm-\${REGION}/latest/linux_amd64/amazon-ssm-agent.rpm"
      ;;
    *)
      echo "Unrecognized distro '\${ID:-unknown}'. Install manually: https://docs.aws.amazon.com/systems-manager/latest/userguide/agent-install.html"
      exit 1
      ;;
  esac
fi

echo "Clearing any stale SSM registration (common on instances cloned from a golden AMI)..."
for path in /var/lib/amazon/ssm/registration \\
            /var/snap/amazon-ssm-agent/current/var/lib/amazon/ssm/registration \\
            /var/snap/amazon-ssm-agent/common/var/lib/amazon/ssm/registration; do
  if [ -f "$path" ]; then
    sudo -n rm -f "$path" && echo "Removed $path"
  fi
done

echo "Restarting SSM Agent so it picks up current IAM role credentials..."
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^amazon-ssm-agent'; then
  sudo -n systemctl enable amazon-ssm-agent
  sudo -n systemctl restart amazon-ssm-agent
  systemctl is-active amazon-ssm-agent
elif command -v snap >/dev/null 2>&1; then
  sudo -n snap restart amazon-ssm-agent || sudo -n snap start amazon-ssm-agent
  snap services amazon-ssm-agent
else
  echo "Could not determine how to start the agent on this system."
  exit 1
fi

echo "Done. It can take a minute to show as Online in AWS Systems Manager."
`.trim()

/**
 * One-time SSH connection (using a PEM/private key you already have) to
 * install and start the SSM Agent, so the instance becomes reachable via
 * SSM Run Command going forward instead of needing SSH again.
 */
export async function bootstrapSsmAgent({ host, port = 22, username, privateKeyPath, passphrase }) {
  const privateKey = await fs.readFile(privateKeyPath, 'utf-8')

  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn
      .on('ready', () => {
        conn.exec(BOOTSTRAP_SCRIPT, (err, stream) => {
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
              resolve({ exitCode, stdout, stderr })
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
