/** Invalidates stale asynchronous responses without coupling request cancellation to fetch. */
export class RequestSequencer {
  private sequence = 0;

  begin() {
    this.sequence += 1;
    return this.sequence;
  }

  invalidate() {
    this.sequence += 1;
  }

  isCurrent(sequence: number) {
    return sequence === this.sequence;
  }
}
