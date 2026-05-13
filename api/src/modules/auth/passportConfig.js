const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const bcrypt = require("bcryptjs");

const User = require("../participants/User");

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";
const CLIENT_BASE = (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim();

function configurePassport() {
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user || !user.passwordHash) {
          return done(null, false, { message: "Invalid email or password" });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
          return done(null, false, { message: "Invalid email or password" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${API_BASE}/api/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
              const email = profile.emails?.[0]?.value;
              user = email ? await User.findOne({ email: email.toLowerCase() }) : null;

              if (user) {
                user.googleId = profile.id;
                if (user.authProvider === "local") user.authProvider = "google";
                await user.save();
              } else {
                user = await User.create({
                  name: profile.displayName || "Google User",
                  email: profile.emails?.[0]?.value,
                  role: "participant",
                  googleId: profile.id,
                  authProvider: "google",
                  avatar: profile.photos?.[0]?.value || "",
                  isVerified: true,
                });
              }
            }

            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  const ghClientId = process.env.GH_OAUTH_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  const ghClientSecret = process.env.GH_OAUTH_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (ghClientId && ghClientSecret) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: ghClientId,
          clientSecret: ghClientSecret,
          callbackURL: `${API_BASE}/api/auth/github/callback`,
          scope: ["user:email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            let user = await User.findOne({ githubId: String(profile.id) });

            if (!user) {
              const email = profile.emails?.[0]?.value;
              user = email ? await User.findOne({ email: email.toLowerCase() }) : null;

              if (user) {
                user.githubId = String(profile.id);
                if (user.authProvider === "local") user.authProvider = "github";
                await user.save();
              } else {
                user = await User.create({
                  name: profile.displayName || profile.username || "GitHub User",
                  email: profile.emails?.[0]?.value,
                  role: "participant",
                  githubId: String(profile.id),
                  authProvider: "github",
                  avatar: profile.photos?.[0]?.value || "",
                  isVerified: true,
                });
              }
            }

            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  return { CLIENT_BASE };
}

module.exports = { configurePassport };
