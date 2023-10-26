class AppError extends Error {
  constructor(message, statusCode) {
    super(message); //used to call the constructor of its parent class to access the parent's properties and methods

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; //only if the error is an operational error, we will send the response to the user

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
