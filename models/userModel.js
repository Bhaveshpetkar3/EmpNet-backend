const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
//name, email, photo password, passwordConfirm

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    // required: [true, 'A user must have a name!'],
    trim: true, // will trim the white spaces in the beginning and the end
  },
  email: {
    type: String,
    required: [true, 'A user must have a email!'],
    trim: true,
    unique: true,
    lowercase: true, // will convert the email to lowercase
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'A user must have a password!'],
    minlength: 8,
    select: false, //to not show in any output
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Confirm password required!'],
    validate: {
      //This only works on SAVE!!!
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same',
    },
  },
  passwordChangedAt: {
    type: Date,
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false, //because we want to hide the implementation details from the user
  },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); //only run this function if password was actually modified

  this.password = await bcrypt.hash(this.password, 12);

  this.passwordConfirm = undefined; //delete the confirmpassword now as we don't want it in our databse as it is plain text.
  next();
});

userSchema.pre('/^find/', function (next) {
  //this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

// userSchema.pre('save', function (next) {
//   if (!this.isModified('password') || this.isNew) return next();
//   this.passwordChangedAt = Date.now() - 1000; //this is because we want jwt to be issued after the password is changed
//   next();
// });

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    //converting to milliseconds and dividing by 1000 to convert to seconds
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    // console.log(changedTimestamp, JWTTimestamp);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Encrypt the plaintext token to be saved in the database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Add an expiry time of 10 minutes to the token
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
