import bcrypt from "bcryptjs";
import User from "../models/User";

export const registerUser = async (
name: string,
email: string,
password: string
) => {
const existingUser = await User.findOne({ email });

if (existingUser) {
throw new Error("Email already exists");
}

const hashedPassword = await bcrypt.hash(password, 10);

const user = await User.create({
name,
email,
password: hashedPassword,
});

return user;
};

export const loginUser = async (
email: string,
password: string
) => {
const user = await User.findOne({ email });

if (!user) {
throw new Error("Invalid credentials");
}

const isPasswordValid = await bcrypt.compare(
password,
user.password
);

if (!isPasswordValid) {
throw new Error("Invalid credentials");
}

return user;
};
