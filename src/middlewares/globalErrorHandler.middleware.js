export const GlobalErrorHandlerMiddleware = async (err, req, res, next) => {
  const error = {};

  error.name = err?.name || "Internal Server Error";
  error.code =
    typeof err?.code === "number" && err.code >= 100 && err.code <= 599
      ? err.code
      : 500;
  error.message = err?.message || "Internal Server Error occurred";
  error.stack = err?.stack;

  if (err?.details) {
    error.details = err.details;
  }

  if (error.code === 500) {
    console.error(error);
  }

  delete error.stack;
  return res.status(error.code).json(error);
};
