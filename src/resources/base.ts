/**
 * Base classes and interfaces for MCP Resources
 */

import type { AtpClient } from '../utils/atp-client.js';
import { Logger } from '../utils/logger.js';

export interface IMcpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface IResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: Uint8Array;
}

/**
 * Base class for MCP resources
 */
export abstract class BaseResource implements IMcpResource {
  public abstract readonly uri: string;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly mimeType: string;

  protected logger: Logger;

  constructor(
    protected atpClient: AtpClient,
    loggerName: string
  ) {
    this.logger = new Logger(loggerName);
  }

  /**
   * Read the resource content
   */
  abstract read(): Promise<IResourceContent>;

  /**
   * Check if the resource is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return this.atpClient.isAuthenticated();
    } catch {
      return false;
    }
  }
}
