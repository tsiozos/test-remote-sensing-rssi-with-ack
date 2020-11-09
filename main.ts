let stationID = 0
basic.showNumber(0)
let stationACK = _py.range(26).fill(0)
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
            console.log("asking for SYNC station " + ("" + i))
            stationACK[i] = 0
            //  reset the last RSSI. This may change async during the loop below
            for (let j = 0; j < 10; j++) {
                if (stationACK[i] == 0) {
                    // if station didn't reply yet keep sending
                    radio.sendValue("SYNC", i)
                    basic.pause(100)
                }
                
            }
            drawNumber(i)
        }
        basic.clearScreen()
    }
    
    drawStationID()
})
// ## DUMP THE stationACKs
input.onButtonPressed(Button.A, function on_button_pressed_a() {
    
    let lack = 26
    for (let i = 1; i < lack; i++) {
        console.log("Station " + ("" + i) + " ACK: " + ("" + Math.map(stationACK[i], 0, 255, -128, -42)))
        basic.pause(100)
    }
})
// #### CLIENT ACCEPTING REQ #####
radio.onReceivedValue(function on_received_value(name: string, value: number) {
    let tries: number;
    
    if (stationID == 0) {
        // if we are the server then accept the ACK command
        if (name == "ACK") {
            if (value > (0 & value) && (0 & value) <= 25) {
                stationACK[value] = Math.map(getRSSI(), -128, -42, 0, 255)
                console.log("station " + ("" + value) + " has RSSI: " + getRSSI() + " (" + stationACK[value] + ")")
            }
            
        }
        
    } else if (name == "SYNC") {
        // if we are a client we send ACK several times
        tries = triesFromRSSI(getRSSI(), 0.95, 9)
        console.log("sending ACK " + ("" + tries) + " times")
        if (value == stationID) {
            // ## REPLY ONLY IF WE HAVE A MATCHING STATIONID
            for (let i = 0; i < tries; i++) {
                // ## tries ARE CALC'd WITH 95% RELIABILITY TARGET
                radio.sendValue("ACK", stationID)
                drawNumber(tries - i)
                basic.pause(randint(1, 10) * 200)
            }
            basic.clearScreen()
        }
        
        drawStationID()
    }
    
})
// #### UTILITIES #####
// #### DRAW A NUMBER WITH LEDS #####
function drawNumber(n: number) {
    basic.clearScreen()
    if (n >= (0 & n) && (0 & n) <= 25) {
        for (let i = 0; i < n; i++) {
            led.plot(i % 5, Math.idiv(i, 5))
        }
    } else {
        basic.showIcon(IconNames.Sad)
    }
    
}

function drawStationID() {
    
    if (stationID > 9) {
        drawNumber(stationID)
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

