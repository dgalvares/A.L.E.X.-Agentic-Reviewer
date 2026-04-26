export class LlmResultParseError extends Error {
  constructor(
    message: string,
    readonly rawResult: string,
  ) {
    super(message);
    this.name = 'LlmResultParseError';
  }
}
