const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();

const server = http.createServer(app);

const io = new Server(server);

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "../public")
    )
);


/* ==============================
   MONGODB
================================ */

const MONGODB_URI =
    process.env.MONGODB_URI;

const client =
    new MongoClient(MONGODB_URI);

let usersCollection;


/* ==============================
   REGISTER
================================ */

app.post(
    "/register",
    async (req, res) => {

        try {

            const {
                username,
                email,
                password
            } = req.body;


            if (
                !username ||
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "All fields are required."

                });

            }


            if (
                username.length < 3
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Username must contain at least 3 characters."

                });

            }


            if (
                password.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must contain at least 6 characters."

                });

            }


            const existingUser =
                await usersCollection.findOne({

                    $or: [

                        {
                            username:
                                username
                        },

                        {
                            email:
                                email.toLowerCase()
                        }

                    ]

                });


            if (existingUser) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Username or email already exists."

                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            await usersCollection.insertOne({

                username:
                    username,

                email:
                    email.toLowerCase(),

                password:
                    hashedPassword,

                age:
                    null,

                gender:
                    null,

                interests:
                    "",

                bio:
                    "",

                createdAt:
                    new Date(),

                updatedAt:
                    new Date()

            });


            console.log(
                "New account created:",
                username
            );


            res.json({

                success: true,

                message:
                    "Account created successfully."

            });


        }

        catch (error) {

            console.error(
                "Register error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Server error."

            });

        }

    }
);


/* ==============================
   LOGIN
================================ */

app.post(
    "/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email and password are required."

                });

            }
             const normalizedEmail =
                String(email).trim().toLowerCase();


            const user =
                await usersCollection.findOne({

                    email:
                        normalizedEmail

                });


            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid email or password."

                });

            }


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid email or password."

                });

            }


            console.log(
                "User logged in:",
                user.username
            );


            res.json({

                success: true,

                username:
                    user.username,

                email:
                    user.email,

                message:
                    "Login successful! Welcome " +
                    user.username

            });


        }

        catch (error) {

            console.error(
                "Login error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Server error."

            });

        }

    }
);


/* ==============================
   PROFILE
================================ */

app.post(
    "/profile",
    async (req, res) => {

        try {

            const {
                username,
                age,
                gender,
                interests,
                bio
            } = req.body;


            const cleanUsername =
                String(username || "").trim();


            if (
                !cleanUsername ||
                !age ||
                !gender
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Username, age and gender are required."

                });

            }


            const numericAge =
                Number(age);


            if (
                !Number.isInteger(
                    numericAge
                ) ||
                numericAge < 18 ||
                numericAge > 100
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Age must be between 18 and 100."

                });

            }


            const result =
                await usersCollection.updateOne(

                    {
                        username:
                            cleanUsername
                    },

                    {

                        $set: {

                            age:
                                numericAge,

                            gender:
                                gender,

                            interests:
                                String(
                                    interests || ""
                                ).trim(),

                            bio:
                                String(
                                    bio || ""
                                ).trim(),

                            updatedAt:
                                new Date()

                        }

                    }

                );


            if (
                result.matchedCount === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User account not found."

                });

            }


            console.log(
                "Profile updated:",
                cleanUsername
            );


            res.json({

                success: true,

                message:
                    "Profile saved successfully! 💫"

            });


        }

        catch (error) {

            console.error(
                "Profile error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Server error."

            });

        }

    }
);


/* ==============================
   HOME
================================ */

app.get(
    "/",
    (req, res) => {

        res.sendFile(

            path.join(
                __dirname,
                "../public/index.html"
            )

        );

    }
);


            


/* ==============================
   SMART MATCHING
================================ */

const waitingUsers =
    new Map();


const userNames =
    new Map();


const activeRooms =
    new Map();


/*
 * Stores the real logged-in
 * username for each socket.
 */

const socketUsers =
    new Map();


/*
 * Stores profile interests
 * for each connected socket.
 */

const socketInterests =
    new Map();


/*
 * Stores users blocked by
 * a socket during this session.
 */

const blockedUsers =
    new Map();


/* ==============================
   STRANGER NAME
================================ */

function generateStrangerName() {

    return (
        "Stranger_" +
        Math.floor(
            1000 +
            Math.random() * 9000
        )
    );

}


/* ==============================
   NORMALIZE INTERESTS
================================ */

function normalizeInterests(
    interests
) {

    if (
        !interests
    ) {

        return [];

    }


    let list = [];


    /*
     * Profile page sends:
     *
     * Gaming, Music, Travel
     */

    if (
        typeof interests === "string"
    ) {

        list =
            interests.split(",");

    }


    /*
     * Also support arrays.
     */

    else if (
        Array.isArray(interests)
    ) {

        list =
            interests;

    }


    return list

        .map(
            item =>
                String(item)
                    .trim()
                    .toLowerCase()
        )

        .filter(
            item => item.length > 0
        );

}


/* ==============================
   COMMON INTERESTS
================================ */

function getCommonInterests(
    interestsA,
    interestsB
) {

    const a =
        normalizeInterests(
            interestsA
        );


    const b =
        normalizeInterests(
            interestsB
        );


    return a.filter(
        interest =>
            b.includes(interest)
    );

}


/* ==============================
   MATCH SCORE
================================ */

function getMatchScore(
    socketIdA,
    socketIdB
) {

    const interestsA =
        socketInterests.get(
            socketIdA
        ) || [];


    const interestsB =
        socketInterests.get(
            socketIdB
        ) || [];


    const common =
        getCommonInterests(
            interestsA,
            interestsB
        );


    return common.length;

}


/* ==============================
   BLOCK CHECK
================================ */

function isBlocked(
    socketIdA,
    socketIdB
) {

    const blocked =
        blockedUsers.get(
            socketIdA
        );


    if (!blocked) {

        return false;

    }


    return blocked.has(
        socketIdB
    );

}


/* ==============================
   GET USER PROFILE
================================ */

async function getUserProfile(
    username
) {

    if (!username) {

        return null;

    }


    try {

        const user =
            await usersCollection.findOne(

                {
                    username:
                        username
                },

                {

                    projection: {

                        _id: 0,

                        username: 1,

                        age: 1,

                        gender: 1,

                        interests: 1,

                        bio: 1

                    }

                }

            );


        if (!user) {

            return null;

        }


        return {

            username:
                user.username ||
                "Stranger",

            age:
                user.age ||
                null,

            gender:
                user.gender ||
                "",

            interests:
                user.interests ||
                "",

            bio:
                user.bio ||
                ""

        };

    }

    catch (error) {

        console.error(
            "Get profile error:",
            error
        );

        return null;

    }

}


/* ==============================
   SOCKET CONNECTION
================================ */

io.on(
    "connection",
    (socket) => {


        const strangerName =
            generateStrangerName();


        userNames.set(
            socket.id,
            strangerName
        );


        console.log(
            "User connected:",
            strangerName,
            socket.id
        );


        /* ==========================
           IDENTIFY USER
        ========================== */

        socket.on(
            "identify user",
            async (username) => {

                try {

                    if (
                        !username ||
                        typeof username !==
                        "string"
                    ) {

                        return;

                    }


                    const cleanUsername =
                        username.trim();


                    const user =
                        await usersCollection.findOne({

                            username:
                                cleanUsername

                        });


                    if (!user) {

                        console.log(
                            "User not found:",
                            cleanUsername
                        );

                        return;

                    }


                    socketUsers.set(
                        socket.id,
                        user.username
                    );


                    const interests =
                        normalizeInterests(
                            user.interests
                        );


                    socketInterests.set(
                        socket.id,
                        interests
                    );


                    console.log(
                        "Socket identified:",
                        user.username,
                        "Interests:",
                        interests
                    );

                    socket.emit(
    "identified",
    {
        username: user.username
    }
);

                }

                catch (error) {

                    console.error(
                        "Identify user error:",
                        error
                    );

                }

            }
        );


        /* ==========================
           FIND STRANGER
        ========================== */

        socket.on(
            "find stranger",
            async () => {

                try {

                    if (
                        waitingUsers.has(
                            socket.id
                        )
                    ) {

                        return;

                    }


                    if (
                        activeRooms.has(
                            socket.id
                        )
                    ) {

                        return;

                    }


                    let bestMatch =
                        null;


                    let bestScore =
                        -1;


                    /*
                     * Search waiting users.
                     */

                    for (
                        const [waitingId]
                        of waitingUsers
                    ) {


                        if (
                            waitingId ===
                            socket.id
                        ) {

                            continue;

                        }


                        /*
                         * Don't match blocked users.
                         */

                        if (
                            isBlocked(
                                socket.id,
                                waitingId
                            ) ||
                            isBlocked(
                                waitingId,
                                socket.id
                            )
                        ) {

                            continue;

                        }


                        const score =
                            getMatchScore(
                                socket.id,
                                waitingId
                            );


                        if (
                            score >
                            bestScore
                        ) {

                            bestScore =
                                score;

                            bestMatch =
                                waitingId;

                        }

                    }


                    /*
                     * No match.
                     */

                    if (
                        !bestMatch
                    ) {

                        waitingUsers.set(
                            socket.id,
                            true
                        );


                        console.log(
                            strangerName +
                            " is waiting..."
                        );


                        socket.emit(
                            "waiting"
                        );


                        return;

                    }


                    const matchedSocket =
                        bestMatch;


                    waitingUsers.delete(
                        matchedSocket
                    );


                    const otherName =
                        userNames.get(
                            matchedSocket
                        );


                    const roomId =
                        "room_" +
                        socket.id;


                    activeRooms.set(
                        socket.id,
                        roomId
                    );


                    activeRooms.set(
                        matchedSocket,
                        roomId
                    );


                    socket.join(
                        roomId
                    );


                    const otherSocket =
                        io.sockets.sockets.get(
                            matchedSocket
                        );


                    if (
                        otherSocket
                    ) {

                        otherSocket.join(
                            roomId
                        );

                    }
/* ==========================
   VERIFY USERNAMES
========================== */

const currentUsername =
    socketUsers.get(socket.id);

const matchedUsername =
    socketUsers.get(matchedSocket);


console.log(
    "================================="
);

console.log(
    "CURRENT USERNAME:",
    currentUsername
);

console.log(
    "MATCHED USERNAME:",
    matchedUsername
);

console.log(
    "CURRENT SOCKET:",
    socket.id
);

console.log(
    "MATCHED SOCKET:",
    matchedSocket
);

console.log(
    "================================="
);


/* ==========================
   MAKE SURE BOTH USERS
   ARE IDENTIFIED
========================== */

if (
    !currentUsername ||
    !matchedUsername
) {

    console.log(
        "Matching stopped: username missing."
    );

    console.log(
        "Current:",
        currentUsername
    );

    console.log(
        "Matched:",
        matchedUsername
    );

    /*
     * Put the matched user back
     * into the waiting queue.
     */

    if (
        otherSocket &&
        !waitingUsers.has(
            matchedSocket
        )
    ) {

        waitingUsers.set(
            matchedSocket,
            true
        );

    }


    socket.emit(
        "waiting"
    );

    return;

}


/* ==========================
   GET BOTH PROFILES
========================== */

const currentProfile =
    await getUserProfile(
        currentUsername
    );


const matchedProfile =
    await getUserProfile(
        matchedUsername
    );


console.log(
    "CURRENT PROFILE:",
    currentProfile
);

console.log(
    "MATCHED PROFILE:",
    matchedProfile
);


/* ==========================
   COMMON INTERESTS
========================== */

const commonInterests =
    getCommonInterests(

        currentProfile?.interests ||
        socketInterests.get(
            socket.id
        ) ||
        [],

        matchedProfile?.interests ||
        socketInterests.get(
            matchedSocket
        ) ||
        []

    );


console.log(
    "COMMON INTERESTS:",
    commonInterests
);


/* ==========================
   CURRENT USER PROFILE
========================== */

const currentProfileData = {

    username:
        currentProfile?.username ||
        currentUsername,

    age:
        currentProfile?.age ??
        null,

    gender:
        currentProfile?.gender ||
        "",

    interests:
        currentProfile?.interests ||
        "",

    bio:
        currentProfile?.bio ||
        ""

};


/* ==========================
   MATCHED USER PROFILE
========================== */

const matchedProfileData = {

    username:
        matchedProfile?.username ||
        matchedUsername,

    age:
        matchedProfile?.age ??
        null,

    gender:
        matchedProfile?.gender ||
        "",

    interests:
        matchedProfile?.interests ||
        "",

    bio:
        matchedProfile?.bio ||
        ""

};


/* ==========================
   SEND MATCH TO CURRENT USER
========================== */

socket.emit(
    "matched",
    {

        roomId:
            roomId,

        strangerName:
            matchedUsername,

        strangerProfile:
            matchedProfileData,

        commonInterests:
            commonInterests,

        matchScore:
            commonInterests.length

    }
);


/* ==========================
   SEND MATCH TO OTHER USER
========================== */

if (
    otherSocket
) {

    otherSocket.emit(
        "matched",
        {

            roomId:
                roomId,

            strangerName:
                currentUsername,

            strangerProfile:
                currentProfileData,

            commonInterests:
                commonInterests,

            matchScore:
                commonInterests.length

        }
    );

}
/* ==========================
   MATCH SUCCESS
========================== */

console.log(
    "================================="
);

console.log(
    "MATCH SUCCESS:",
    currentUsername || "Unknown",
    "<->",
    matchedUsername || "Unknown"
);

console.log(
    "CURRENT PROFILE:",
    currentProfile
);

console.log(
    "MATCHED PROFILE:",
    matchedProfile
);

console.log(
    "================================="
);


/* ==========================
   CLOSE FIND STRANGER
========================== */

                }

                catch (error) {

                    console.error(
                        "Matching error:",
                        error
                    );

                }

            }
        );


/* ==========================
   CHAT MESSAGE
========================== */

socket.on(
    "chat message",
    (message) => {

        const roomId =
            activeRooms.get(
                socket.id
            );


        if (!roomId) {

            return;

        }


        if (
            typeof message !== "string"
        ) {

            return;

        }


        const cleanMessage =
            message.trim();


        if (!cleanMessage) {

            return;

        }


        if (
            cleanMessage.length > 500
        ) {

            return;

        }


        io.to(roomId).emit(
            "chat message",
            {

                sender:
                    socket.id,

                message:
                    cleanMessage,

                createdAt:
                    new Date()

            }
        );

    }
);




        /* ==========================
           TYPING INDICATOR
        ========================== */

        socket.on(
            "typing",
            (isTyping) => {

                const roomId =
                    activeRooms.get(
                        socket.id
                    );


                if (!roomId) {

                    return;

                }


                socket.to(
                    roomId
                ).emit(
                    "stranger typing",
                    Boolean(isTyping)
                );

            }
        );


        /* ==========================
           NEXT STRANGER
        ========================== */

        socket.on(
            "next stranger",
            () => {


                leaveCurrentRoom(
                    socket
                );


                setTimeout(
                    () => {

                        if (
                            socket.connected
                        ) {

                            socket.emit(
                                "waiting"
                            );

                        }

                    },
                    100
                );

            }
        );


        /* ==========================
           BLOCK STRANGER
        ========================== */

        socket.on(
            "block stranger",
            () => {


                const roomId =
                    activeRooms.get(
                        socket.id
                    );


                if (!roomId) {

                    return;

                }


                const room =
                    io.sockets.adapter
                        .rooms.get(
                            roomId
                        );


                if (room) {

                    for (
                        const id of room
                    ) {

                        if (
                            id !== socket.id
                        ) {


                            /*
                             * Remember block.
                             */

                            if (
                                !blockedUsers.has(
                                    socket.id
                                )
                            ) {

                                blockedUsers.set(
                                    socket.id,
                                    new Set()
                                );

                            }


                            blockedUsers
                                .get(
                                    socket.id
                                )
                                .add(id);


                            io.to(id).emit(
                                "blocked by stranger"
                            );

                        }

                    }

                }


                socket.emit(
                    "block successful"
                );


                leaveCurrentRoom(
                    socket
                );

            }
        );


        /* ==========================
           REPORT STRANGER
        ========================== */

        socket.on(
            "report stranger",
            (reason) => {


                console.log(
                    "Report from:",
                    strangerName,
                    reason
                );


                socket.emit(
                    "report successful"
                );

            }
        );

        /* ==========================
           DISCONNECT
        ========================== */

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "User disconnected:",
                    strangerName
                );

                waitingUsers.delete(
                    socket.id
                );

                leaveCurrentRoom(
                    socket,
                    true
                );

                userNames.delete(
                    socket.id
                );

                socketUsers.delete(
                    socket.id
                );

                socketInterests.delete(
                    socket.id
                );

                blockedUsers.delete(
                    socket.id
                );

            }
        );

    }   // CLOSE io.on("connection")

);      // CLOSE io.on()


/* ==============================
   LEAVE CURRENT ROOM
================================ */

function leaveCurrentRoom(
    socket,
    disconnected = false
) {

    const roomId =
        activeRooms.get(
            socket.id
        );

    if (!roomId) {
        return;
    }

    const room =
        io.sockets.adapter.rooms.get(
            roomId
        );

    if (room) {

        for (const id of room) {

            if (id !== socket.id) {

                io.to(id).emit(
                    "stranger disconnected"
                );

                activeRooms.delete(id);
            }
        }
    }

    activeRooms.delete(
        socket.id
    );

    socket.leave(
        roomId
    );

    if (!disconnected) {

        waitingUsers.set(
            socket.id,
            true
        );

    }

}


/* ==============================
   START SERVER
================================ */

async function startServer() {

    try {

        await client.connect();

        console.log(
            "MongoDB Atlas connected successfully!"
        );

        const database =
            client.db(
                "avinash_match_aura"
            );

        usersCollection =
            database.collection(
                "users"
            );

        const PORT =
            process.env.PORT || 3000;

        server.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `Avinash Match Aura running on port ${PORT}`
                );

            }
        );

    }

    catch (error) {

        console.error(
            "MongoDB connection failed:",
            error
        );

    }

}


startServer();