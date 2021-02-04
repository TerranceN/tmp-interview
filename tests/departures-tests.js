const server = require('../server')
const mongoose = require("mongoose");
const departureModel = require('../models/departure')
const chai = require('chai');
const chaiHttp = require('chai-http');
const assert = chai.assert;

chai.use(chaiHttp);

let expressServer;

describe('Departures', function() {
	before(async () => {
		// Note this database is different than the one in server.js so tests don't drop the dummy data
		expressServer = await server.startApp(`mongodb://${server.dbBaseUrl}/trains-tests`);
	});

	beforeEach(async () => {
		const models = mongoose.models;
		await Promise.all(Object.keys(models).map(
			modelName => models[modelName].remove({})
		));
	})

  describe('POST /departures', () => {
    it('should create a new departure when it receives all the keys it needs', async () => {
			const response = await chai.request(expressServer)
			  .post(`/departures`)
				.send({
					departingStation: 'A',
					departingTime: new Date(),
					arrivalStation: 'B',
					arrivalTime: new Date(),
					ticketPrice: 100,
					numberOfSeats: 5,
				});

			assert.equal(response.status, 200);
			
			const found = await departureModel.findById(response.body._id);
			assert.exists(found);
			assert.deepEqual(response.body, JSON.parse(JSON.stringify(found)));
    });

    it('should not create the departure if required keys are missing', async () => {
			const response = await chai.request(expressServer)
			  .post(`/departures`)
				.send({
					arrivalStation: 'B',
					arrivalTime: new Date(),
					ticketPrice: 100,
					numberOfSeats: 5,
				});

			assert.equal(response.status, 400);
			
			const found = await departureModel.findById(response.body._id);
			assert.notExists(found);
    });
  });

  describe('GET /departures/:departureId', () => {
    it('should get the requested departure if it exists', async () => {
			const created = await departureModel.create({
				departingStation: 'A',
				departingTime: new Date(),
				arrivalStation: 'B',
				arrivalTime: new Date(),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const response = await chai.request(expressServer)
			  .get(`/departures/${created._id}`)

			assert.equal(response.status, 200);
			assert.equal(response.body._id, created._id);
    });

    it('should return a 404 if it does not exists', async () => {
			const fakeId = '000000000000000000000000';

			const response = await chai.request(expressServer)
			  .get(`/departures/${fakeId}`)

			assert.equal(response.status, 404);
    });
  });

  describe('DELETE /departures/:departureId', () => {
    it('should remove the requested departure from the DB if it exists', async () => {
			const created = await departureModel.create({
				departingStation: 'A',
				departingTime: new Date(),
				arrivalStation: 'B',
				arrivalTime: new Date(),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const response = await chai.request(expressServer)
			  .delete(`/departures/${created._id}`)

			assert.equal(response.status, 204);

			const found = await departureModel.findById(response.body._id);
			assert.notExists(found);
    });

    it('should return a 404 if the departure does not exist', async () => {
			const fakeId = '000000000000000000000000';

			const response = await chai.request(expressServer)
			  .get(`/departures/${fakeId}`)

			assert.equal(response.status, 404);
    });
  });

  describe('POST /departures/search', () => {
    it('should pick the fastest route between two routes', async () => {
			const slowRoute = await departureModel.create({
				departingStation: 'A',
				departingTime: new Date(0),
				arrivalStation: 'B',
				arrivalTime: new Date(100),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const fastRoute = await departureModel.create({
				departingStation: 'A',
				departingTime: new Date(0),
				arrivalStation: 'B',
				arrivalTime: new Date(10),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const response = await chai.request(expressServer)
			  .post('/departures/search')
				.send({
					time: 0,
					start: 'A',
					destination: 'B'
				})

			assert.equal(response.status, 200);
			assert.deepEqual(response.body.departures, [ fastRoute._id.toString() ]);
    });

    it('should explore routes that are slower at the beginning but faster at the end', async () => {
			// Make two routes:
			// A -> B -> C where A -> B is fast, but B -> C is _really_ slow
			// A -> D -> C where A -> D is slower than A -> B, but D -> C is _really_ fast
			// The search should pick the second one (since it is in total faster)

			const departureAB = await departureModel.create({
				departingStation: 'A',
				departingTime: new Date(0),
				arrivalStation: 'B',
				arrivalTime: new Date(10),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const departureBC = await departureModel.create({
				departingStation: 'B',
				departingTime: new Date(10),
				arrivalStation: 'C',
				arrivalTime: new Date(110),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const departureAD = await departureModel.create({
				departingStation: 'A',
				departingTime: new Date(0),
				arrivalStation: 'D',
				arrivalTime: new Date(50),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const departureDC = await departureModel.create({
				departingStation: 'D',
				departingTime: new Date(50),
				arrivalStation: 'C',
				arrivalTime: new Date(60),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const response = await chai.request(expressServer)
			  .post('/departures/search')
				.send({
					time: 0,
					start: 'A',
					destination: 'C'
				})

			assert.equal(response.status, 200);
			assert.deepEqual(response.body.departures, [ departureAD, departureDC ].map(d => d._id.toString()));
			assert.equal(response.body.finalArrivalTime, departureDC.arrivalTime.getTime());
    });

    it('should return a 404 if there is no route to the destination', async () => {
			await departureModel.create({
				departingStation: 'A',
				departingTime: new Date(0),
				arrivalStation: 'B',
				arrivalTime: new Date(100),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			await departureModel.create({
				departingStation: 'B',
				departingTime: new Date(100),
				arrivalStation: 'C',
				arrivalTime: new Date(200),
				ticketPrice: 100,
				numberOfSeats: 5,
			});

			const response = await chai.request(expressServer)
			  .post('/departures/search')
				.send({
					time: 0,
					start: 'A',
					destination: 'Z'
				})

			assert.equal(response.status, 404);
    });
  });
});
