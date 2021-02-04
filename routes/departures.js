const express = require('express');
const asyncHandler = require('express-async-handler');
const departureModel = require('../models/departure');

const router = express.Router();

// Creates a new departure record
router.route('/')
	.post(asyncHandler(async (req, res) => {
		try {
			const departure = await departureModel.create(req.body);
			res.status(200).send(departure);
		} catch (error) {
			switch (error.name) {
				case 'ValidationError':
					// given parameters don't make a valid departure
					res.sendStatus(400);
					break;
				default:
					console.error(error);
					res.sendStatus(500);
			}
		}
	}))

// Finds or deletes a departure record
router.route('/:departureId')
	.get(asyncHandler(async (req, res) => {
		try {
			const departure = await departureModel.findById(req.params.departureId);
			if (departure) {
				res.status(200).send(departure);
			} else {
				res.sendStatus(404);
			}
		} catch (error) {
			switch (error.name) {
				case 'CastError':
					// departureId wasn't a valid id
					res.sendStatus(400);
					break;
				default:
					console.error(error);
					res.sendStatus(500);
			}
		}
	}))
	.delete(asyncHandler(async (req, res) => {
		const deleted = await departureModel.remove({ _id: req.params.departureId });

		if (deleted) {
			res.sendStatus(204);
		} else {
			res.sendStatus(404);
		}
	}))

// Performs a search using the dijkstra algorithm
const asyncDijkstra = async ({
	// The list of starting routes
	initialRoutes,
	// Given a route, is the route at the end
	isRouteFinished,
	// Given a route, returns a Promise to an array of routes
	nextRoutesForRoute,
	// Given two routes, returns the lower cost one
	compareRoutes
}) => {
	let routesToSearch = initialRoutes;

	// While we have routes to search though, and we haven't found the finish, continue
	while(routesToSearch.length > 0 && !isRouteFinished(routesToSearch[0])) {
		// Get the first route in the list and remove it
		const currentRoute = routesToSearch.shift();

		// Get the routes branching off the current route
		const newRoutes = await nextRoutesForRoute(currentRoute);

		// Add them to the list of routes to search though and sort the nodes so
		// the new first node has the lowest 'cost' (determined by sortNodesFn)
		routesToSearch = routesToSearch.concat(newRoutes);
		routesToSearch.sort(compareRoutes);
	}

	if (routesToSearch.length > 0) {
		// The first node has finished, so return it
		return routesToSearch[0];
	} else {
		// All options searched and no path found
		return null;
	}
}

// Searches through the routes for the fastest options to get from point a to b
// Takes three parameters:
//
// time: the unix timestamp to start searching from
// start: the name of the station to start at
// destination: the name of the station to end at
router.route('/search')
  .post(asyncHandler(async (req, res) => {
		const currentTime = req.body.time;
		const start = req.body.start;
		const destination = req.body.destination;

		const resultingRoute = await asyncDijkstra({
			initialRoutes: [{
				station: start,
				cost: 0,
				time: new Date(currentTime),
				alreadyVisited: [],
				departures: [],
			}],
			isRouteFinished: (route) => route.station === destination,
			nextRoutesForRoute: async (route) => departureModel.aggregate([
				// Filter departures
				{
					$match: {
						// Leaving from this station
						departingStation: route.station,

						// Going to a station we haven't already visited on this route
						arrivalStation: { $nin: route.alreadyVisited },

						// departing later than now
						departingTime: { $gte: route.time },
					}
				},
				// Set an ordering
				{ $sort: { arrivalTime: 1 } },
				// Use the ordering to find the first arrival by station
				{
					$group: {
						_id: '$arrivalStation',
						departureId: { $first: '$_id' },
						ticketPrice: { $first: '$ticketPrice' },
						arrivalTime: { $first: '$arrivalTime' },
					}
				},
				// Only output the fields needed for the routes
				{
					$project: {
						station: '$_id',
						cost: { $add: [ route.cost, '$ticketPrice' ] },
						time: '$arrivalTime',
						alreadyVisited: route.alreadyVisited.concat([route.station]),
						departures: { $concatArrays: [ route.departures, [ '$departureId' ] ] },
					}
				}
			]),
			compareRoutes: (routeA, routeB) => routeA.time < routeB.time ? 1 : -1,
		});

		if (resultingRoute) {
			const { departures, cost, time } = resultingRoute;
			res.status(200).send({
				departures,
				totalCost: cost,
				finalArrivalTime: new Date(time).getTime(),
			});
		} else {
			res.sendStatus(404);
		}
	}));

module.exports = { router };
