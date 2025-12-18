import cloudinary from "../../lib/cloudinary.js";
import { generateToken } from "../../lib/utils.js";
import User from "../models/user.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import bcrypt from "bcryptjs";

// SignUp new User

export const SignUp = async (req, res) => {
  try {
    const { fullname, email, password, bio } = req.body;
    if (!fullname || !email || !password || !bio) {
      return res.json(new ApiResponse(404, {}, "Missing details"));
    }
    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res.json(new ApiResponse(409, { existedUser }, "User already exists"));
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullname,
      email,
      password: hashedPassword,
      bio,
    });

    const token = await generateToken(user._id);
    return res.json(
      new ApiResponse(200, { user,token }, "Account Created Successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.json(new ApiResponse(400, {}, error));
  }
};

// login User

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.json(
        new ApiResponse(404, {}, "User with this email does not exist")
      );
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.json(new ApiResponse(404, {}, "Invalid User Credentials"));
    }
    const token = await generateToken(user._id);
    res.json(new ApiResponse(200, { user, token }, "Login successful"));
  } catch (error) {
    console.log(error.message);
    return res.json(new ApiResponse(400, {}, error.message));
  }
};

//Check if user is authenticated

export const chekAuth = async (req, res) => {
  return res.json(new ApiResponse(200, req.user, "User is Authenticated"));
};

//update user profile details

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullname } = req.body;
    const userId = req.user._id;
    let updatedUser;

    if (!profilePic) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { bio, fullname },
        { new: true }
      );
    } else {
      const upload = await cloudinary.uploader.upload(profilePic);

      updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          profilePic: upload.secure_url,
          bio,
          fullname,
        },
        { new: true }
      );
    }

    return res.json(
      new ApiResponse(200, { updatedUser }, "User Details updated Successfully")
    );
  } catch (error) {
    console.log(error.message);
    return res.json(new ApiResponse(409, {}, error.message));
  }
};

