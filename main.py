class SENSOR:
    STATION=0
    LIGHT=1
    COMPASS=2
    TEMPER=3
    ROLL=4
    PITCH=5
    ACCX=6
    ACCY=7
    ACCZ=8
    ROTX=9
    ROTY=10
    ROTZ=11
    MAGX=12
    MAGY=13
    MAGZ=14

stationID = 0
basic.show_number(0)
stationACK = range(26).fill(0)
radio.set_group(79)
radio.set_transmit_power(7)

# CLIENT: SETUP DATA STRUCTURE
dataBuffer = bytearray(19)
dataBuffer.fill(0)


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
            drawUpToNumber(i)
            print ("asking for SYNC station "+str(i))
            stationACK[i] = 0   # reset the last RSSI. This may change async during the loop below
            for j in range(10):
                if stationACK[i] == 0:    #if station didn't reply yet keep sending
                    radio.send_value("SYNC", i)
                    basic.pause(10+randint(1,5)*7)
        basic.clear_screen()
    drawClientMap()
input.on_button_pressed(Button.AB, on_button_pressed_ab)

### SERVER: DUMP THE stationACKs
def on_button_pressed_a():
    global stationACK
    lack = 26
    for i in range(1,lack):
        if stationACK[i]!=0:
            print("Station "+str(i)+" ACK: "+ str(Math.map(stationACK[i],1,255,-128,-42)))
            basic.pause(100)
    drawClientMap()
input.on_button_pressed(Button.A, on_button_pressed_a)

##### CLIENT/SERVER: ACCEPTING REQ #####
def on_received_value(name, value):
    global stationID, stationACK, dataBuffer
    if stationID == 0:    #SERVER: accept the ACK command
        if name == "ACK":
            if value > 0 & value <= 25:
                stationACK[value] = Math.map(getRSSI(),-128,-42,1,255)
                print("station "+str(value)+" has RSSI: "+getRSSI()+" ("+stationACK[value]+")")
                drawClientMap()
    elif name=="SYNC":    #CLIENT reply with ACK several times
            tries = triesFromRSSI(getRSSI(),0.95,9)     # MAXIMUM 9 TRIES
            print("sending ACK "+str(tries)+" times")
            if value == stationID:      ### REPLY ONLY IF WE HAVE A MATCHING STATIONID
                for i in range(tries):  ### tries ARE CALC'd WITH 95% RELIABILITY TARGET
                    radio.send_value("ACK",stationID)
                    drawUpToNumber(tries-i)
                    basic.pause(randint(1, 10)*100)
                basic.clear_screen()
            drawStationID()
    else:
        if name[0:6]=="DATARQ":     #CLIENT: SEND DATA ARRAY BACK TO SERVER
            statID = int(name[6:])
            if statID==stationID:   #CLIENT: ARE WE THE STATION BEING ASKED?
                tries = triesFromRSSI(getRSSI(), 0.95, 9)
                print("sending DATA "+str(tries)+ " times")
                dataBuffer[SENSOR.STATION] = stationID
                dataBuffer[SENSOR.LIGHT]=input.light_level()
                dataBuffer[SENSOR.TEMPER]=input.temperature()
                dataBuffer[SENSOR.COMPASS]=Math.map(input.compass_heading(),0,359,0,255)
                dataBuffer[SENSOR.PITCH]=Math.map(input.rotation(Rotation.PITCH),-180,180,0,255)
                dataBuffer[SENSOR.ROLL]=Math.map(input.rotation(Rotation.ROLL),-180,180,0,255)
                magx = Math.round(Math.constrain(input.magnetic_force(Dimension.X),-127,127))
                dataBuffer[SENSOR.MAGX]=Math.map(magx,-127,127,0,255)
                for i in range(tries):
                    radio.send_buffer(dataBuffer)
                    drawUpToNumber(tries-i-1)   # SHOW HOW MANY TRIES ARE LEFT
                    basic.pause(randint(1,5)*100)

radio.on_received_value(on_received_value)

#SERVER: RECEIVED DATA ARRAY FROM CLIENT
def on_received_buffer(receivedBuffer):
    print("Recv'd data from stat "+str(receivedBuffer[0]))
    print("Light: "+str(receivedBuffer[SENSOR.LIGHT]))
    print("Temp: "+str(receivedBuffer[SENSOR.TEMPER]))
    print("Compass: "+str(Math.map(receivedBuffer[SENSOR.COMPASS],0,255,0,359)))
    print("Pitch: "+str(Math.map(receivedBuffer[SENSOR.PITCH],0,255,-180,180)))
    print("Roll: "+str(Math.map(receivedBuffer[SENSOR.ROLL],0,255,-180,180)))

radio.on_received_buffer(on_received_buffer)

#SERVER: ASKING A CLIENT FOR DATA ARRAY
def on_pin_pressed_p0():
    global stationID
    if stationID == 0:
        # CALCULATE TRIES BASED ON PREVIOUS RSSI FROM THIS CLIENT
        # THE STATIONACK ARRAY HOLDS THE LAST RSSI FROM THIS CLIENT
        # WE'RE SCALING THE RSSI FROM -128dB TO -42dB TO 1-255 RANGE AND BACK
        tries = triesFromRSSI(Math.map(stationACK[14],1,255,-128,-42),0.95,9)
        print("asking for DATA "+ str(tries)+ " times")
        for i in range(tries):
            radio.send_value("DATARQ14", 0)
            basic.pause(randint(1,5)*50)
            drawSingleNumber(14,255*(tries%2))
    basic.clear_screen()

input.on_pin_pressed(TouchPin.P0, on_pin_pressed_p0)

##### UTILITIES #####

##### SERVER: DRAW CLIENT MAP #####
def drawClientMap():
    global stationACK
    lack = 26
    basic.clear_screen()
    for i in range(1,lack):
        if stationACK[i]==0:
            drawSingleNumber(i,10)
        else:
            drawSingleNumber(i,255)


##### DRAW A NUMBER WITH LEDS #####
def drawUpToNumber(n: number):
    basic.clear_screen()
    if n>=0 & n<=25:
        for i in range(n):
            led.plot(i % 5, i // 5)
    else:
        basic.show_icon(IconNames.SAD)

def drawSingleNumber(n: number, intensity: number):
    n=n-1
    if n>=0 & n<=25:
        led.plot_brightness(n % 5, n // 5 ,intensity)
    else:
        basic.show_icon(IconNames.SAD)
##### CLIENT/SERVER: DRAW STATIONID USING LEDS #####
def drawStationID():
    global stationID
    if stationID > 9:
        drawUpToNumber(stationID)
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
#drawSingleNumber(1,255)
#drawSingleNumber(5,255)
#drawSingleNumber(21,255)
#drawSingleNumber(25,255)

#strt = "DATARQ14"
#print(strt[6:])
