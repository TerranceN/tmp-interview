const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const departure = new Schema(
  {
		// Name of the station the departure is starting at
		// Is just a string key with a letter
		departingStation: {
			type: String,
			required: true,
		},
		departingTime: {
			type: Date,
			required: true,
		},
		// Name of the station the departure is ending at
		// Is just a string key with a letter
		arrivalStation: {
			type: String,
			required: true,
		},
		arrivalTime: {
			type: Date,
			required: true
		},
		ticketPrice: {
			type: Number,
			required: true
		},
		numberOfSeats: {
			type: Number,
			required: true,
		}
  },
  { collection: "Departures" }
);

module.exports = mongoose.model("departures", departure);
