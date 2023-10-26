const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    //Each review document must know what tour it belongs to so we will use parent referencing
    //In our case, it will reference to a Service offered by an employee
    // tour: [
    //   {
    //     type: mongoose.Schema.ObjectId,
    //     ref: 'Tour',
    //     required: [true, 'Review must belong to a tour.'],
    //   },
    // ],
    //Each review must be attached with a user
    user: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Review must belong to a user.'],
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function (next) {
  // this.populate({ path: 'tour', select: 'name' }).populate({
  //   path: 'user',
  //   select: 'name photo',
  // });
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  next();
});

//post middleware has no access to next

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
