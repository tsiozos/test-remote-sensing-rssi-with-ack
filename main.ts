class SENSOR {
    static STATION = 0
    static LIGHT = 1
    static COMPASS = 2
    static TEMPER = 3
    static ROLL = 4
    static PITCH = 5
    static ACCX = 6
    static ACCY = 7
    static ACCZ = 8
    static ROTX = 9
    static ROTY = 10
    static ROTZ = 11
    static MAGX = 12
    static MAGY = 13
    static MAGZ = 14
}

let stationID = 0
basic.showNumber(0)
let stationACK = _py.range(26).fill(0)
radio.setGroup(79)
radio.setTransmitPower(7)
//  CLIENT: SETUP DATA STRUCTURE
let dataBuffer = control.createBuffer(19)
dataBuffer.fill(0)
// #### SETUP #####
input.onButtonPressed(Button.B, function on_button_pressed_b() {
    
    stationID = (stationID + 1) % 26
    drawStationID()
})
// #### SERVER #####
// #### SEND SYNC REQ #####
input.onButtonPressed(Button.AB, function on_button_pressed_ab() {
    
    // ASKING FOR RE-SYNC. OLD RSSI VALUES IGNORED
    if (stationID == 0) {
        for (let i = 1; i < 26; i++) {
            drawUpToNumber(i)
            console.log("asking for SYNC station " + ("" + i))
            stationACK[i] = 0
            //  reset the last RSSI. This may change async during the loop below
            for (let j = 0; j < 10; j++) {
                if (stationACK[i] == 0) {
                    // if station didn't reply yet keep sending
                    radio.sendValue("SYNC", i)
                    basic.pause(10 + randint(1, 5) * 7)
                }
                
            }
        }
        basic.clearScreen()
    }
    
    drawClientMap()
})
// ## SERVER: DUMP THE stationACKs
input.onButtonPressed(Button.A, function on_button_pressed_a() {
    
    let lack = 26
    for (let i = 1; i < lack; i++) {
        if (stationACK[i] != 0) {
            console.log("Station " + ("" + i) + " ACK: " + ("" + Math.map(stationACK[i], 1, 255, -128, -42)))
            basic.pause(100)
        }
        
    }
    drawClientMap()
})
// #### CLIENT/SERVER: ACCEPTING REQ #####
radio.onReceivedValue(function on_received_value(name: string, value: number) {
    let tries: number;
    let i: number;
    let statID: number;
    let magx: number;
    
    if (stationID == 0) {
        // SERVER: accept the ACK command
        if (name == "ACK") {
            if (value > (0 & value) && (0 & value) <= 25) {
                stationACK[value] = Math.map(getRSSI(), -128, -42, 1, 255)
                console.log("station " + ("" + value) + " has RSSI: " + getRSSI() + " (" + stationACK[value] + ")")
                drawClientMap()
            }
            
        }
        
    } else if (name == "SYNC") {
        // CLIENT reply with ACK several times
        tries = triesFromRSSI(getRSSI(), 0.95, 9)
        //  MAXIMUM 9 TRIES
        console.log("sending ACK " + ("" + tries) + " times")
        if (value == stationID) {
            // ## REPLY ONLY IF WE HAVE A MATCHING STATIONID
            for (i = 0; i < tries; i++) {
                // ## tries ARE CALC'd WITH 95% RELIABILITY TARGET
                radio.sendValue("ACK", stationID)
                drawUpToNumber(tries - i)
                basic.pause(randint(1, 10) * 100)
            }
            basic.clearScreen()
        }
        
        drawStationID()
    } else if (name.slice(0, 6) == "DATARQ") {
        // CLIENT: SEND DATA ARRAY BACK TO SERVER
        statID = parseInt(name.slice(6))
        if (statID == stationID) {
            // CLIENT: ARE WE THE STATION BEING ASKED?
            tries = triesFromRSSI(getRSSI(), 0.95, 9)
            console.log("sending DATA " + ("" + tries) + " times")
            dataBuffer[SENSOR.STATION] = stationID
            dataBuffer[SENSOR.LIGHT] = input.lightLevel()
            dataBuffer[SENSOR.TEMPER] = input.temperature()
            dataBuffer[SENSOR.COMPASS] = Math.map(input.compassHeading(), 0, 359, 0, 255)
            dataBuffer[SENSOR.PITCH] = Math.map(input.rotation(Rotation.Pitch), -180, 180, 0, 255)
            dataBuffer[SENSOR.ROLL] = Math.map(input.rotation(Rotation.Roll), -180, 180, 0, 255)
            magx = Math.round(Math.constrain(input.magneticForce(Dimension.X), -127, 127))
            dataBuffer[SENSOR.MAGX] = Math.map(magx, -127, 127, 0, 255)
            for (i = 0; i < tries; i++) {
                radio.sendBuffer(dataBuffer)
                drawUpToNumber(tries - i - 1)
                //  SHOW HOW MANY TRIES ARE LEFT
                basic.pause(randint(1, 5) * 100)
            }
        }
        
    }
    
})
// SERVER: RECEIVED DATA ARRAY FROM CLIENT
radio.onReceivedBuffer(function on_received_buffer(receivedBuffer: Buffer) {
    console.log("Recv'd data from stat " + ("" + receivedBuffer[0]))
    console.log("Light: " + ("" + receivedBuffer[SENSOR.LIGHT]))
    console.log("Temp: " + ("" + receivedBuffer[SENSOR.TEMPER]))
    console.log("Compass: " + ("" + Math.map(receivedBuffer[SENSOR.COMPASS], 0, 255, 0, 359)))
    console.log("Pitch: " + ("" + Math.map(receivedBuffer[SENSOR.PITCH], 0, 255, -180, 180)))
    console.log("Roll: " + ("" + Math.map(receivedBuffer[SENSOR.ROLL], 0, 255, -180, 180)))
})
// SERVER: ASKING A CLIENT FOR DATA ARRAY
input.onPinPressed(TouchPin.P0, function on_pin_pressed_p0() {
    let tries: number;
    
    if (stationID == 0) {
        //  CALCULATE TRIES BASED ON PREVIOUS RSSI FROM THIS CLIENT
        //  THE STATIONACK ARRAY HOLDS THE LAST RSSI FROM THIS CLIENT
        //  WE'RE SCALING THE RSSI FROM -128dB TO -42dB TO 1-255 RANGE AND BACK
        tries = triesFromRSSI(Math.map(stationACK[14], 1, 255, -128, -42), 0.95, 9)
        console.log("asking for DATA " + ("" + tries) + " times")
        for (let i = 0; i < tries; i++) {
            radio.sendValue("DATARQ14", 0)
            basic.pause(randint(1, 5) * 50)
            drawSingleNumber(14, 255 * (tries % 2))
        }
    }
    
    basic.clearScreen()
})
// #### UTILITIES #####
// #### SERVER: DRAW CLIENT MAP #####
function drawClientMap() {
    
    let lack = 26
    basic.clearScreen()
    for (let i = 1; i < lack; i++) {
        if (stationACK[i] == 0) {
            drawSingleNumber(i, 10)
        } else {
            drawSingleNumber(i, 255)
        }
        
    }
}

// #### DRAW A NUMBER WITH LEDS #####
function drawUpToNumber(n: number) {
    basic.clearScreen()
    if (n >= (0 & n) && (0 & n) <= 25) {
        for (let i = 0; i < n; i++) {
            led.plot(i % 5, Math.idiv(i, 5))
        }
    } else {
        basic.showIcon(IconNames.Sad)
    }
    
}

function drawSingleNumber(n: number, intensity: number) {
    n = n - 1
    if (n >= (0 & n) && (0 & n) <= 25) {
        led.plotBrightness(n % 5, Math.idiv(n, 5), intensity)
    } else {
        basic.showIcon(IconNames.Sad)
    }
    
}

// #### CLIENT/SERVER: DRAW STATIONID USING LEDS #####
function drawStationID() {
    
    if (stationID > 9) {
        drawUpToNumber(stationID)
    } else {
        basic.showNumber(stationID)
    }
    
    
}

function getRSSI(): number {
    return radio.receivedPacket(RadioPacketProperty.SignalStrength)
}

function triesN(y: number, p: number): number {
    return Math.ceil(Math.log(1 - y) / Math.log(p))
}

function lossP(y: number, n: number): number {
    return Math.pow(1 - y, 1 / n)
}

function triesFromRSSI(rssi: number, y: number, maxtries: number): number {
    let t: number;
    let rssi2 = rssi + 100
    let p = Math.min(1, 5936.2673 * rssi2 ** -3.7231)
    //  this function may return a p > 1
    //  so we limit it to 1
    if (p == 1) {
        t = maxtries
    } else {
        t = Math.max(1, triesN(y, p))
    }
    
    // if tries fall below 1, at least 1 try
    return t
}

