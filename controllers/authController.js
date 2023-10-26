const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const sendEmail = require('../utils/email');
const AppError = require('../utils/appError');

const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true; //because we want to test the cookie and .secure requires https which we cannot use rn

  //Creating a cookie
  res.cookie('jwt', token, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // const newUser = await User.create(req.body);//not safe

  //only allowing to insert those fields which we need in our database
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1]Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  //2]Check if the user exists && password is correct
  const user = await User.findOne({ email: email }).select('+password'); //we are using this select because in the tourModel, we have set the select property to false for the password field
  const correct = await user.correctPassword(password, user.password); //it is defined in userModel.js

  if (!user || !correct) {
    return next(new AppError('Incorrect email or password', 401));
  }

  //3]If everything is ok, send token to client
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  //1]Get the token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    next(
      new AppError('Your are not logged in! Please log in to get access.', 401),
    );
  }
  //2]Validate the token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log(decoded);

  //3] Check if user still exists
  const freshUser = await User.findById(decoded.id);
  // console.log(freshUser);
  if (!freshUser) {
    return next(
      new AppError(
        `The user belonging to this token does no longer exists!!`,
        401,
      ),
    );
  }

  //4] Check if the user changed password after the token was issued

  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! please log in again.', 401),
    );
  }

  req.user = freshUser; //it will contain current logged in user's information
  next();
});

// to restrict the important functions from accessing by unauthorized persons
exports.restrict = catchAsync(async (req, res, next) => {
  next();
});

//function to give access only to specified user roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    //roles ['admin','lead-guide']
    if (!roles.includes(req.user.role)) {
      //we have access to req.user.role because prior to calling this function in tourController, we called protect method that saves req.user
      return next(
        new AppError('you do not have permission to perform this action', 403),
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('The email does not exist', 404));
  }

  // Generate the random reset token
  const resetToken = user.createPasswordResetToken();

  //imp => The below line will deactivate all the validators before saving the fields
  await user.save({ validateBeforeSave: false }); //the validatores are will not be checked now before saving this

  // Send it back to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host',
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH requestt with your new password and passwordConfirm to: ${resetURL}\n If you didn't forget your password, please ignore this email!`;
  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });
    res
      .status(200)
      .json({ status: 'success', message: 'Token sent to email!' });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500,
      ),
    );
  }
});

exports.resetPassword = async (req, res, next) => {
  // 1] get user based on the
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  // console.log(hashedToken);
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2] If the token is not expired and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3] Update changedPasswordAt property for the user

  // 4] Log the user in, send JWT
  createSendToken(user, 200, res);
};

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1] Get the user from collection
  const user = await User.findOne({ email: req.user.email }).select(
    '+password',
  );

  //2] Check if the POSTed current password is correct
  // console.log(req.body.password, user.password);
  const correct = await user.correctPassword(
    req.body.passwordCurrent,
    user.password,
  );
  if (!correct) {
    return next(new AppError('Incorrect password entered', 401));
  }

  // //3] Update the password
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  //4] Log user in, send JWT
  createSendToken(user, 200, res);
});
