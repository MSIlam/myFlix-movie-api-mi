const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const Models = require("./models.js");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { check, validationResult } = require("express-validator");
const { capitalizeFirstLetter } = require("./helpers.js");
const app = express();
// const swaggerJSDoc = require("swagger-jsdoc");
// const swaggerUi = require("swagger-ui-express");
const uuid = require("uuid");
// importing the mongoose models
const Movies = Models.Movie;
const Users = Models.User;

// cors implementation of web server
let allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:1234",
  "https://myflix-mi.netlify.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        // If a specific origin isn’t found on the list of allowed origins
        let message =
          "The CORS policy for this application doesn’t allow access from origin " +
          origin;
        return callback(new Error(message), false);
      }
      return callback(null, true);
    },
  })
);
// log file
const accessLogStream = fs.createWriteStream(path.join(__dirname, "log.txt"), {
  flags: "a",
});

app.use(morgan("combined", { stream: accessLogStream }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS implementation
// app.use(cors());

let auth = require("./auth.js")(app);
const passport = require("passport");
require("./passport.js");

// connecting to the dtabase
// local
// mongoose.connect("mongodb://127.0.0.1:27017/MyFlixDBMONGO", {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

// remote
mongoose.connect(process.env.CONNECTION_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.get("/", (req, res) => {
  let responseText = "Welcome to the movie world!";
  res.send(responseText);
});

// Return all movies to the user [Read]
app.get(
  "/movies",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Movies.find()
      .then((movies) => {
        res.status(200).json(movies);
        console.log("Movies:", movies);
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send("Error: " + error);
      });
  }
);

// //
// Return data about a single movie by title to the user [Read]
app.get(
  "/users/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Users.findById(req.params.id)
      .then((user) => {
        res.json(user);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Error:" + err);
      });
  }
);
// Return data about a single movie by title to the user [Read]
app.get(
  "/movies/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Movies.findById(req.params.id)
      .then((movie) => {
        res.json(movie);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Error:" + err);
      });
  }
);

// return data about a genre
app.get(
  "/movies/genres/:name",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { name } = req.params;
    try {
      const movie = await Movies.findOne({
        "Genres.Name": capitalizeFirstLetter(name),
      });
      if (movie) {
        const genre = movie.Genres;
        res.status(200).json(genre);
      } else {
        res.status(404).json({ message: `Genre "${name}" not found.` });
      }
    } catch (err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    }
  }
);

//
// Return data about a director (bio, birth year, death year) by name [Read]
app.get(
  "/movies/directors/:name",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { name } = req.params;
    try {
      const movies = await Movies.findOne({
        "Director.Name": capitalizeFirstLetter(name),
      });
      if (movies) {
        res.json(movies.Director);
      } else {
        res.status(404).json({ message: `Director "${name}" not found.` });
      }
    } catch (err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    }
  }
);

//
// Allow new users to register [CREATE]
app.post(
  "/users",
  [
    check("Username", "Username is required").isLength({ min: 5 }),
    check(
      "Username",
      "Username contains non alphanumeric characters - not allowed."
    ).isAlphanumeric(),
    check("Password", "Password is required").not().isEmpty(),
    check("Email", "Email does not appear to be valid").isEmail(),
  ],
  async (req, res) => {
    // check the validation object for errors
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const hashedPassword = Users.hashPassword(req.body.Password);
    await Users.findOne({ Username: req.body.Username }) // Search to see if a user with the requested username already exists
      .then((user) => {
        if (user) {
          //If the user is found, send a response that it already exists
          return res.status(400).send(req.body.Username + " already exists");
        } else {
          Users.create({
            Username: req.body.Username,
            Password: hashedPassword,
            Email: req.body.Email,
            Birthday: req.body.Birthday,
          })
            .then((user) => {
              res.status(201).json(user);
            })
            .catch((error) => {
              console.error(error);
              res.status(500).send("Error: " + error);
            });
        }
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send("Error: " + error);
      });
  }
);

//
// update user info by username
app.put(
  "/users/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const hashedPassword = Users.hashPassword(req.body.Password);
    console.log(req.user._id.toString(), req.params.id);
    if (req.user._id.toString() !== req.params.id) {
      return res.status(400).send("permission denied");
    }
    await Users.findOneAndUpdate(
      { _id: req.params.id },
      {
        $set: {
          Username: req.body.Username,
          Password: hashedPassword,
          Email: req.body.Email,
          Birthday: req.body.Birthday,
        },
      },
      { new: true }
    ) // This line makes sure that the updated document is returned
      .then((updatedUser) => {
        res.json(updatedUser);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send("Error: " + err);
      });
  }
);

//
// Add a  movie to a user's list of favourites

app.post(
  "/users/:id/movies/:MovieId",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      // Validate that MovieId is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(req.params.MovieId)) {
        return res.status(400).send("Invalid MovieId");
      }

      // Check if the movie with the provided MovieId exists
      const movie = await Movies.findById(req.params.MovieId);
      if (!movie) {
        return res.status(404).send("Movie not found");
      }

      // Update the user's list of favorite movies
      const updatedUser = await Users.findOneAndUpdate(
        { _id: req.params.id },
        {
          $addToSet: { FavouriteMovies: req.params.MovieId },
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).send("User not found");
      }

      res.json(updatedUser);
    } catch (err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    }
  }
);

//
// Allow users to remove a movie from their list of favorits  [DELETE]
app.delete(
  "/users/:id/movies/:MovieId",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const updatedUser = await Users.findOneAndUpdate(
        { _id: req.params.id },
        {
          $pull: {
            FavouriteMovies: req.params.MovieId, // Assuming the MovieId is provided as a URL parameter
          },
        },
        { new: true }
      );

      if (!updatedUser) {
        res.status(404).json({ message: `User '${req.params.id}' not found.` });
      } else {
        res.status(200).json(updatedUser);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

//
// Delete user by userid
app.delete(
  "/users/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Users.findOneAndRemove({ _id: req.params.id })
      .then((user) => {
        if (!user) {
          res.status(400).send(req.params.id + " was not found");
        } else {
          res.status(200).send(req.params.id + " was deleted");
        }
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Error:" + err);
      });
  }
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log("Listening on Port " + port);
});
