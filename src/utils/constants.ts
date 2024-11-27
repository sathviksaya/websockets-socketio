const constants = {
  PRODUCTION: "production",
  DEVELOPMENT: "development",

  //  Express
  PORT: Number(process.env.PORT) || 8000,
  APP_ENV: () => process.env.APP_ENV || constants.DEVELOPMENT,
  IS_PROD: () => constants.APP_ENV() == constants.PRODUCTION,

  // SocketIO
  BASE_URL: () => constants.IS_PROD() ? "https://websockets.<EXAMPLE.COM>" : `http://localhost:${constants.PORT}`,
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || "websockets-jwt-secret-key",
  AUTH_TOKEN: process.env.AUTH_TOKEN || "websockets-auth-token",
  ORIGIN: ["*"],

  // GCP Redis
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_DATABASE: Number(process.env.REDIS_DATABASE) || 0,
};

export default constants;
