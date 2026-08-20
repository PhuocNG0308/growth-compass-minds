import { networkInterfaces } from 'node:os';

export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((info) => info?.family === 'IPv4' && !info.internal)
    .map((info) => info!.address);
}

export function reachableAt(port: number): string[] {
  return [`http://localhost:${port}`, ...lanAddresses().map((ip) => `http://${ip}:${port}`)];
}
