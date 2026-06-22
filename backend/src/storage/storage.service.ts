import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IStorageService, StoredFile } from './storage.interface';

/**
 * Local filesystem implementation of IStorageService.
 *
 * Files are written under `STORAGE_ROOT/<subPath>/<uuid>-<sanitized-name>` and
 * served via a public URL prefix of `/files/<subPath>/<uuid>-<sanitized-name>`.
 * Swap this service for an S3-backed implementation later without touching callers.
 */
@Injectable()
export class StorageService implements IStorageService {
  private readonly root: string;
  private readonly publicPrefix = '/files';

  constructor(private readonly config: ConfigService) {
    this.root = path.resolve(this.config.get<string>('STORAGE_ROOT', './storage'));
  }

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    subPath = 'misc',
  ): Promise<StoredFile> {
    const safeSubPath = this.sanitizeSegment(subPath);
    const dir = path.join(this.root, safeSubPath);
    await fs.mkdir(dir, { recursive: true });

    const sanitizedName = this.sanitizeSegment(originalName);
    const filename = `${randomUUID()}-${sanitizedName}`;
    const fullPath = path.join(dir, filename);

    await fs.writeFile(fullPath, buffer);

    return {
      url: `${this.publicPrefix}/${safeSubPath}/${filename}`,
      originalName,
      size: buffer.length,
      mimeType,
    };
  }

  getPath(url: string): string {
    if (!url.startsWith(this.publicPrefix)) {
      throw new Error(`Cannot resolve path for URL outside of ${this.publicPrefix}: ${url}`);
    }
    const relative = url.slice(this.publicPrefix.length);
    const resolved = path.normalize(path.join(this.root, relative));
    if (!resolved.startsWith(this.root)) {
      throw new Error('Resolved path escapes storage root');
    }
    return resolved;
  }

  async delete(url: string): Promise<void> {
    try {
      await fs.unlink(this.getPath(url));
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  private sanitizeSegment(segment: string): string {
    return segment
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 200) || 'file';
  }
}
