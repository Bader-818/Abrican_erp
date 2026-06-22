export interface StoredFile {
  /** Public URL/path clients use to fetch the file (e.g. "/files/documents/abc.pdf") */
  url: string;
  /** Original filename as uploaded */
  originalName: string;
  /** Size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

export interface IStorageService {
  /** Persist a file buffer under an optional sub-path, returning a StoredFile descriptor */
  save(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    subPath?: string,
  ): Promise<StoredFile>;

  /** Resolve a previously returned URL back to an absolute filesystem path */
  getPath(url: string): string;

  /** Delete a previously stored file (no-op if it does not exist) */
  delete(url: string): Promise<void>;
}
