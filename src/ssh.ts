/**
 * SSH utility for executing commands on remote servers
 * Uses the system's SSH config (~/.ssh/config) for connection settings
 */

export interface SSHResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SSHOptions {
  host: string;
  timeout?: number;
}

/**
 * Execute a command on a remote server via SSH
 * Uses SSH config for connection details (hostname, user, key)
 */
export async function sshExec(
  command: string,
  options: SSHOptions
): Promise<SSHResult> {
  const { host, timeout = 30000 } = options;

  const proc = Bun.spawn(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Set up timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill();
      reject(new Error(`SSH command timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    const result = await Promise.race([
      proc.exited,
      timeoutPromise,
    ]);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: result as number,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) {
      throw error;
    }
    throw new Error(`SSH execution failed: ${error}`);
  }
}

/**
 * Test SSH connection to a host
 */
export async function testConnection(host: string): Promise<boolean> {
  try {
    const result = await sshExec("echo 'ok'", { host, timeout: 10000 });
    return result.exitCode === 0 && result.stdout === "ok";
  } catch {
    return false;
  }
}
