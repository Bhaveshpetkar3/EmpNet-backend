const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1] Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    next(
      new AppError(
        'This route is not for password updates. Pleast use /update-password',
        400,
      ),
    );
  }

  // Filter out unwanted field names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email'); //we are using this because we only want the user to update the fields that we want him to do and prevent them from any unauthorized changes.

  // 2] Update user document

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined! Please use /signup instead',
  });
};

exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.updateUser = factory.updateOne(User); //Do not update passwords with this
exports.deleteUser = factory.deleteOne(User); //only the administrator will be able to completely delete the user from the database. Normal user will only change the active status to false
