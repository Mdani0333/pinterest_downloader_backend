class BadRequestException extends Error {
  static code = 400;
  constructor(message) {
    if (!message) super("Bad request");
    else super(message);
    this.code = BadRequestException.code;
    this.name = "BadRequestException";
  }
}

export { BadRequestException };
