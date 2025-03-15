class NotFoundException extends Error {
  static code = 404;
  constructor(message) {
    if (!message) super("Not Found!");
    else super(message);
    this.code = NotFoundException.code;
    this.name = "NotFoundException";
  }
}

export { NotFoundException };
