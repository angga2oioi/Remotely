import { credentialVault } from '../vault/credentialVault.js'

/**
 * Resolves a project's stored AWS credentials into an SDK v3 config object,
 * used to construct scoped EC2/SSM clients per request.
 */
export async function resolveAwsConfig(projectId) {
  const credentials = await credentialVault.getProfile(projectId)
  if (!credentials) {
    throw new Error(`No AWS credentials attached to project: ${projectId}`)
  }
  const { accessKeyId, secretAccessKey, sessionToken, region } = credentials
  return {
    region,
    credentials: { accessKeyId, secretAccessKey, sessionToken }
  }
}
