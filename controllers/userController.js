const User = require('../models/userModel');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const otpGenerator = require("otp-generator");
const randomstring = require('randomstring');

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.log(error);
    }
};

const otpSent = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Verify Your Email',
            html: `<p>Your OTP is: <strong>${otp}</strong></p>`,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.log(error.message);
    }
};

//for sending recovery mail
const resetPasswordMail = async (username, email, token) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            }
        })


        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: "For Reset Password",
            html: `<p> Hi, ${username}, please click here to <a href="https://vatchshop.online/forgotPassword?token=${token}"> Reset </a> your password</p>`
        }

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                next(error);
            } else {
                console.log("Email Has been Sent:-", info, response);
            }
        })

    } catch (error) {
        next(error);
    }
};

module.exports = {
    loadLogin: async (req, res, next) => {
        try {
            res.render('login');
        } catch (error) {
            next(error);
        }
    },

    loginLoad: async (req, res, next) => {
        try {
            res.render('login');
        } catch (error) {
            next(error);
        }
    },

    verifyLogin: async (req, res, next) => {
        try {
            const email = req.body.email;
            const password = req.body.password;

            const user = await User.findOne({ email });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (isPasswordValid) {
                if (user.isBlocked) {
                    return res.status(401).json({ error: "Your account is blocked. Please contact support for assistance." });
                } else {
                    // You can use session or token-based authentication as needed
                    req.session.userId = user._id;
                    return res.status(200).json({ success: "Login successful" });
                }
            } else {
                return res.status(401).json({ error: "Incorrect Password" });
            }
        } catch (error) {
            next(error);
        }
    },

    loadForget: async (req, res, next) => {
        try {
            res.render('forgetPassword');
        } catch (error) {
            next(error);
        }
    },

    forgotVerify: async (req, res, next) => {
        try {
            const email = req.body.email
            const userData = await User.findOne({ email: email })

            if (userData) {
                if (userData.isVerified === false) {
                    res.render('forgetPassword', { message: "Please verify your mail" })
                } else {
                    const randomString = randomstring.generate()
                    const updatedData = await User.updateOne({ email: email },
                        { $set: { token: randomString } })

                    resetPasswordMail(userData.firstName, userData.email, randomString)
                    res.render('forgetPassword', { message: "Please Check Your Mail to Reset Your Password" })
                }
            } else {
                res.render('forgetPassword', { message: "User email is Incorrect" })
            }
        } catch (error) {
            next(error);
        }
    },

    loadForgotPassword: async (req, res, next) => {
        try {
            const token = req.query.token;

            // Assuming you have a 'token' field in your user schema
            const user = await User.findOne({ token: token });

            if (user) {
                // Render the view with the user information
                res.render('forgotPassword', { user_id: user._id });
            } else {
                res.render('forgotPassword', { message: 'Invalid Token' });
            }
        } catch (error) {
            next(error);
        }
    },

    //Resetting Password  
    forgotPassword: async (req, res, next) => {
        try {
            const id = req.body.id;

            if (!id) {
                return res.status(400).send('User ID is missing in the form submission');
            }

            // You may want to validate the password and confirm password fields here
            const password = req.body.password;

            // Hash the new password before saving it to the database
            const hashedPassword = await bcrypt.hash(password, 10);

            // Update the user's password in the database
            const user = await User.findOneAndUpdate(
                { _id: id },
                { $set: { password: hashedPassword } },
                { new: true }
            );


            if (!user) {
                return res.status(404).send('User not found in the database');
            }

            res.render("login", { message: "Password Changed Successfully, Proceed To Sign In" });

        } catch (error) {
            next(error);
        }
    },

    loadRegister: async (req, res, next) => {
        try {
            res.render('registration');
        } catch (error) {
            next(error);
        }
    },

    userLogout: async (req, res, next) => {
        try {
            req.session.destroy()
            res.redirect('/')
        } catch (error) {
            next(error);
        }
    },

    loadOtp: async (req, res, next) => {
        try {
            res.render('otp');
        } catch (error) {
            next(error);
        }
    },

    insertUser: async (req, res, next) => {
        try {
            const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });
            const currentTime = new Date();
            const otpCreationTime = currentTime.getMinutes()
            req.session.otp = {
                code: otp,
                creationTime: otpCreationTime,
            };

            const { referalCode, passwordConfirm, password, mobileno, email, lastName, firstName } = req.body
            req.session.email = email
            const userCheck = await User.findOne({ email });

            if (userCheck) {
                res.json({ success: false, message: "Email already exists" });
            } else {
                const hashedPassword = await securePassword(password);

                if (firstName && email && lastName && mobileno) {
                    if (password === passwordConfirm) {
                        if (referalCode) {
                            const referringUser = await User.findOne({ referalCode }).populate('wallet');
                            // const referringUser = await User.findOne({ referalCode });

                            if (referringUser) {
                                const transactionId = randomstring.generate(10);
                                // Credit the referring user with 100 (or any desired amount)
                                referringUser.wallet.totalAmount += 100; // Assuming 'totalAmount' is the field representing the wallet balance
                                referringUser.wallet.walletHistory.push({
                                    transactionAmount: 100,
                                    transactionType: 'credit',
                                    transactionId,
                                });
                                await referringUser.wallet.save();
                            } else {
                                return res.json({ success: false, message: "Invalid Referal Code" });
                            }
                        }

                        const user = new User({
                            firstName,
                            lastName,
                            email,
                            mobileno,
                            password: hashedPassword
                        });
                        const result = await user.save();

                        otpSent(email, req.session.otp.code);
                        res.json({ success: true, message: "User registered successfully" });
                    } else {
                        res.json({ success: false, message: "Password doesn't match" });
                    }
                } else {
                    res.json({ success: false, message: "Please enter all details" });
                }
            }
        } catch (error) {
            next(error);
        }
    },

    loadHome: async (req, res, next) => {
        try {
            const { category: selectedCategory, sort, search } = req.query;
            const categories = await Category.find({ isListed: true });
            const filterCriteria = { isListed: true };

            if (selectedCategory) {
                const categoryObject = await Category.findOne({
                    categoryName: { $regex: new RegExp(".*" + selectedCategory + ".*", "i") },
                });

                if (categoryObject) {
                    filterCriteria.productCategory = categoryObject._id;
                }
            }

            // Add search functionality
            if (search) {
                filterCriteria.productName = { $regex: new RegExp(".*" + search + ".*", "i") };
            }

            let sortOption = {};

            if (sort === "lowtohigh") {
                sortOption = { discountedPrice: 1 };
            } else if (sort === "hightolow") {
                sortOption = { discountedPrice: -1 };
            }

            const products = await Product.find(filterCriteria)
                .populate('productCategory')
                .sort(sortOption);

            const Analog = await Category.findOne({ categoryName: 'Analog' });
            const Smart = await Category.findOne({ categoryName: 'Smart' });
            const Digital = await Category.findOne({ categoryName: 'Digital' });

            res.render('userHome', { product: products, Digital, Smart, Analog, category: categories, currentSort: sort, selectedCategory, search });
        } catch (error) {
            next(error);
        }
    },


    verifyOTP: async (req, res, next) => {
        try {
            const enteredOTP = req.body.otp;
            const storedOTP = req.session.otp.code;
            const otpCreationTime = req.session.otp.creationTime;
            const email = req.session.email

            const currentTimeFull = new Date();
            const currentTime = currentTimeFull.getMinutes()

            const timeDiff = (currentTime - otpCreationTime);

            if (enteredOTP === storedOTP && timeDiff <= 1) {
                const user = await User.findOne({ email: email });

                if (user) {
                    user.isVerified = true;
                    const updatedUser = await user.save();

                    if (updatedUser) {
                        res.render('login', { message: "Registration successful" });
                    } else {
                        res.render('otp', { message: "Error updating user data" });
                    }
                } else {
                    res.render('otp', { message: "User not found" });
                }
            } else {
                res.render('otp', { message: "Invalid OTP or OTP has expired" });
            }
        } catch (error) {
            next(error);
        }
    },

    resendOTP: async (req, res, next) => {
        try {
            const newOTP = otpGenerator.generate(6, { upperCase: false, specialChars: false });
            req.session.otp.code = newOTP;
            const currentTime = new Date();
            req.session.otp.creationTime = currentTime.getMinutes()
            otpSent(req.session.email, req.session.otp.code);

            res.render("otp", { message: "OTP resent successfully" });
        } catch (error) {
            next(error);
        }
    },
};
