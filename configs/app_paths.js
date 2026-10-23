const API_URL = `${process.env.API_HOST}:${process.env.API_PORT}/api/v1`;
const EMAIL_HTTP_URL = `${process.env.EMAIL_HTTP_HOST}:${process.env.EMAIL_HTTP_PORT}`;

const appPaths = {
  API_URL,
  EMAIL_HTTP_URL,
};

export default appPaths;
