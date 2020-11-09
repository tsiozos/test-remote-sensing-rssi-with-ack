stationID = 0
basic.show_number(0)
stationACK = range(26).fill(0)

##### SETUP #####
def on_button_pressed_b():
    global stationID
    stationID = (stationID + 1) % 26
    drawStationID()
input.on_button_pressed(Button.B, on_button_pressed_b)

##### SERVER #####
##### SEND SYNC REQ #####

def on_button_pressed_ab():
    global stationID, stationACK
    #ASKING FOR RE-SYNC. OLD RSSI VALUES IGNORED
    if stationID == 0:
        for i in range(1,26):
            print ("asking for SYNC station "+str(i))
            stationACK[i] = 0   # reset the last RSSI. This may change async during the loop below
            for j in range(10):
                if stationACK[i] == 0:    #if station didn't reply yet keep sending
                    radio.send_value("SYNC", i)
                    basic.pause(100)
            drawNumber(i)
        basic.clear_screen()
    drawStationID()
input.on_button_pressed(Button.AB, on_button_pressed_ab)

### DUMP THE stationACKs
def on_button_pressed_a():
    global stationACK
    lack = 26
    for i in range(1,lack):
        print("Station "+str(i)+" ACK: "+ str(Math.map(stationACK[i],0,255,-128,-42)))
        basic.pause(100)
input.on_button_pressed(Button.A, on_button_pressed_a)

##### CLIENT ACCEPTING REQ #####
def on_received_value(name, value):
    global stationID, stationACK
    if stationID == 0:    #if we are the server then accept the ACK command
        if name == "ACK":
            if value > 0 & value <= 25:
                stationACK[value] = Math.map(getRSSI(),-128,-42,0,255)
                print("station "+str(value)+" has RSSI: "+getRSSI()+" ("+stationACK[value]+")")
    else:
        if name=="SYNC":    #if we are a client we send ACK several times
            tries = triesFromRSSI(getRSSI(),0.95,9)
            print("sending ACK "+str(tries)+" times")
            if value == stationID:      ### REPLY ONLY IF WE HAVE A MATCHING STATIONID
                for i in range(tries):  ### tries ARE CALC'd WITH 95% RELIABILITY TARGET
                    radio.send_value("ACK",stationID)
                    drawNumber(tries-i)
                    basic.pause(randint(1, 10)*200)
                basic.clear_screen()
            drawStationID()
radio.on_received_value(on_received_value)


##### UTILITIES #####
##### DRAW A NUMBER WITH LEDS #####
def drawNumber(n: number):
    basic.clear_screen()
    if n>=0 & n<=25:
        for i in range(n):
            led.plot(i % 5, i // 5)
    else:
        basic.show_icon(IconNames.SAD)

def drawStationID():
    global stationID
    if stationID > 9:
        drawNumber(stationID)
    else:
        basic.show_number(stationID)
    pass

def getRSSI():
    return radio.received_packet(RadioPacketProperty.SIGNAL_STRENGTH)

def triesN(y,p):
    return Math.ceil(Math.log(1-y)/Math.log(p))

def lossP(y,n):
    return Math.pow((1-y),1/n)

def triesFromRSSI(rssi: float, y:float, maxtries: int):
    rssi2 = rssi + 100
    p = Math.min(1,5936.2673*rssi2**(-3.7231)) # this function may return a p > 1
    # so we limit it to 1
    if p==1:
        t = maxtries
    else:
        t = Math.max(1,triesN(y,p))  #if tries fall below 1, at least 1 try
    return t

#drawNumber(19)