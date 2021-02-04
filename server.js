const express = require('express');
const mongoose = require('mongoose')
const bodyParser = require('body-parser');

const { router: departuresRouter } = require('./routes/departures');
const { router: bookingRouter } = require('./routes/booking');

//const dbBaseUrl = 'localhost:27017';
const dbBaseUrl = 'interview_user:interview_pass@209.141.56.251';

const startMongoConnection = async (dbConnectionUrl) => {
  return new Promise(resolve => {
    console.log(`Connecting to ${dbConnectionUrl}`);
    mongoose.connect(dbConnectionUrl, { useUnifiedTopology: true, useNewUrlParser: true });
    const connection = mongoose.connection;

    connection.once("open", function() {
      console.log("MongoDB database connection established successfully");
      resolve();
    });
  })
};

const startApp = async (dbConnectionUrl) => {
  const app = express();
  const port = 3000;

  await startMongoConnection(dbConnectionUrl);

  app.use(bodyParser.json());

  app.use('/departures', departuresRouter);
  app.use('/booking', bookingRouter);

  return app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
  });
};

module.exports = { startApp, dbBaseUrl };

if (require.main === module) {
	startApp(`mongodb://${dbBaseUrl}/trains`);
}
