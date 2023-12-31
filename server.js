const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const app = require('./app');

// app.use(cors());

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION....SHUTTING DOWN');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => 'DB connection successful');

const port = 3000;

const server = app.listen(port, () =>
  console.log(`Server is running on port ${port}...`),
);

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION....SHUTTING DOWN');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
