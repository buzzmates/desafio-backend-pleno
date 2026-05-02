export class OrderNotFound extends Error {
  constructor() {
    super('order not found');
    this.name = 'OrderNotFound';
  }
}
