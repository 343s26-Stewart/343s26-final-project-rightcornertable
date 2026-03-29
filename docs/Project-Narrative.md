# Tripcast

**Team name:** Right Corner Table

**Student names:** Aidan B., Alex H., Frank H., Tate M.

## Purpose

Planning a trip or a day out should be exciting, but uncertainty about the weather often leaves people underprepared or making last-minute changes to their plans. Tripcast is a weather aware activity planner that takes the guesswork out of deciding what to do, all based on the forecast.

Users enter a destination and date, and the app retrieves real time weather forecast data for that location, and recommends activities suited to the expected conditions. A sunny day might have suggestions like hiking or outdoor dining, while a cold or rainy forecast shifts the recommendations towards things like museums, coffee shops, and indoor entertainment.

The core problem Tripcast solves is the disconnect between knowing what the weather will be, and knowing what to actually do about it. Standard weather apps give users numbers and icons, but leave the planning entirely up to them. Tripcast bridges that gap by turning forecast data into actionable suggestions, saving users valuable time and effort. This is especially nice when visiting an unfamiliar city or destination, where users may not already know what options are available to them.

## Users

Tripcast is designed for everyone who makes plans around the weather, whether that means a weekend trip to a new place, a day off with nothing scheduled, or coordinating an outing with friends or family. The app requires no technical background and is built to be immediately accessible and intuitive for a general audience. Primary users include casual travelers who want to make the most of time in an unfamiliar place, locals looking for ideas on how to spend a day, and people who simply want a smarter starting point for planning rather than bouncing between a weather app and a search engine.

These users benefit from Tripcast because it consolidates two steps, checking the forecast and figuring out what to do, into one seamless experience. Rather than opening multiple apps or tabs, users get a single immediate answer: here is the weather, and here is what you can do with it.

The app's responsive design ensures it works just as well on a phone as on a desktop, which matters for users checking plans on the go. Saved searches and locations also benefit users who plan ahead and want to revisit their options without re-entering information each time.

## Features

Tripcast's core features are built around a simple, two-input flow: a destination field and a date picker. Once submitted, the app geocodes the location using the Open-Meteo geocoding endpoint to resolve it to coordinates, then queries the Open-Meteo forecast API to retrieve weather data for the selected date. The forecast, including temperature, precipitation probability, wind speed, and sky conditions, is displayed clearly alongside a set of activity recommendations generated based on those conditions.

For example, a user planning a trip to Asheville, NC on April 12th enters the city name and date. The app returns a forecast of 68 degrees and mostly sunny, and recommends activities like visiting the Blue Ridge Parkway, exploring downtown art galleries, or dining on a restaurant patio. If the forecast had instead shown heavy rain and 45 degrees, the recommendations would shift to indoor options like the Asheville Art Museum or local breweries.

Users can save searches to revisit later, export their saved plans as a JSON file for sharing or backup, and import previously exported data. The interface is fully responsive and meets WCAG 2.1 AA accessibility standards throughout.

## Data

Tripcast handles several categories of data through standard CRUD (create, read, update, delete) operations, all persisted locally via localStorage. Users create data when they submit a new location and date search, and the app stores that query along with the returned forecast and generated activity recommendations as a saved plan. Users read that data when they return to the app and browse their saved searches. They can update saved plans by editing a destination or date and re-running the forecast, which overwrites the stored result. They can delete individual saved plans they no longer need.

A representative sample of a stored entry might look like this: a saved plan with a destination of "Richmond, VA," a date of "2026-04-15," a forecasted high of 72 degrees, 10% precipitation probability, and activity recommendations including "Maymont Park," "Brown's Island Riverfront," and "The Fan District walking tour." This object would be stored as a JSON entry in localStorage and included in any exported file the user downloads. Imported files follow the same structure, allowing users to load plans saved from a previous session or shared by another user without any data loss or formatting issues.
