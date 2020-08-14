import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import * as auth from './authorization'
import models from '../db/models'
import nodemailer from 'nodemailer'

const generateToken = (user) =>
jwt.sign({ userId: user.id }, auth.SECRET, { expiresIn: '14d' })

export const register = async (username, email, passRaw) => {
    const isUserExist = await models.users.findOne({ where: { username } })
    if(isUserExist) {
        throw new Error('User already exist!')
    }
    if(passRaw.length < 8) {
        throw new Error('Password is too short!')
    }
    if(username.length > 20) {
        throw new Error('username is too long!')
    }
    const pass = await bcrypt.hash(passRaw, 10)

    const etoken = await jwt.sign({ name: username }, auth.SECRET, {expiresIn: '1d'})
    const url = `http://localhost:3005/confirmation/${etoken}`

    let transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
        user: 'rentalNetNoReply@gmail.com',
        pass: auth.AUTHORIZATION_CODE
        }
    })

    const message = {
        from: 'rentalNetNoReply@gmail.com',
        to: email,
        subject: 'Confirm your email',
        html: `
                <body style="background-color: #f0d6b9;">
                    <div style="
                        align-items: center;
                        text-align: center;
                        width:100%;
                        font-size: 1.5em;
                        font-family: Arial, Helvetica, sans-serif;
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                        color:#852a37;">
                        <div style="font-size: 2em;
                        margin-top: 4vh;
                        width: auto;
                        background-color: crimson;
                        color: #f2d5d7;
                        margin-bottom:2vh;
                        padding: 10px;">Hi, ${username}!</div>
                        <div id="content">
                            It's enormous pleasure to have you in our family!<br>
                            Click button below to confirm your email and start using Rental Net website.
                        </div>
                        <a href="${url}"><button style="
                        margin-top: 3vh;
                        font-size: 1.5em;
                        cursor: pointer;
                        background-color: #f0515c;
                        color: #f2d5d7;
                        border: none;
                        border-radius: 15px;
                        padding: 5px;">Click me</button></a>
                        <div style="margin-top: 3vh;
                        color:darkgrey;
                        margin-bottom: 2vh;
                        font-size:0.8em;">This message has been generated automatically. Please don't respond to it.</div>
                    </div>
                </body>`
    }
    transport.sendMail(message, function(err, info) {
        if (err) {
            console.log(err)
        } else {
            console.log(info);
        }
    })

    return models.users.create({ username, email, pass })
}

export const login = async (username, pass) => {
    const user = await models.users.findOne({where: { username }})
    if(!user) { throw new Error('User not found!') }

    const valid = await bcrypt.compare(pass, user.pass)
    if(!valid) { throw new Error('Incorrect password!') }

    if(!user.isConfirmed) {
        throw new Error('Your email is not confirmed. Please check your mail.')
    }

    return {token: generateToken(user), user}
}

export const update = async (id, passRaw) => {
    const pass = await bcrypt.hash(passRaw, 10)

    return models.users.update(pass, { where: { id } })
}

export const userMiddleware = async (req) => {
    const token = req.headers.auth
    try {
        if(token) {
            const { userId } = await jwt.verify(token, auth.SECRET)
            req.userId = userId
        }
    } catch (error) {
        console.log(error)
    }

    req.next()
}