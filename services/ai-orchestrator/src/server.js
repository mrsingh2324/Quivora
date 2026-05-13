const dotenv = require("dotenv");
const { patchConsole } = require("./utils/logger");

dotenv.config();
patchConsole();

const app = require("./app");

const PORT = process.env.PORT || 4100;

app.listen(PORT, () => {
  console.log(`AI service listening on port ${PORT}`);
});
