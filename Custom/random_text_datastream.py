import random
import string

initialText = "CapstoneProject3RetroSynthwave"
# after n frames will this program concat new chars to the string
frameInterval = 15 
maxCharCount = 30 # maximum amount of characters allowed

def onSetupParameters(scriptOp):
    return

def onCook(scriptOp):
    # force single line of text
    scriptOp.textFormat = True
    
    currentFrame = int(absTime.frame)

    # init text on first cook
    if 'text' not in scriptOp.storage:
        scriptOp.storage['text'] = initialText

    # append a random character at every n-th frame
    if not currentFrame % frameInterval:
        x, y = readTrackingDAT(scriptOp)
        scriptOp.storage['text'] += randomChar(x, y)
        if len(scriptOp.storage['text']) > maxCharCount:
            scriptOp.storage['text'] = scriptOp.storage['text'][1:] # delete earliest character

    out = scriptOp.storage['text']

    # output as plain text
    scriptOp.text = scriptOp.storage['text']

# works as a reset pulse
def onPulse(par):
    par.owner.storage['text'] = initialText

# returns first data row of input(location = 0)
def readTrackingDAT(scriptOp):
    if scriptOp.inputs:
        trackingData = scriptOp.inputs[0]
    else:
        trackingData = None
        
	# verify if input is valid
    # if invalid return (0.0, 0.0)
    if trackingData is None or trackingData.numRows < 1 or trackingData.numCols < 2:
        return 0.0, 0.0
    
	# if valid grab first line of (x, y) data
    try:
        x = float(trackingData[0, 0].val)
        y = float(trackingData[0, 1].val)
        return x, y
    except Exception:
        return 0.0, 0.0


def randomChar(x, y):
    letters = "1234567890ABCDEFGHIJLKMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@#$%^&*()_+|:<>?`"
    normalizedX = x / 20 + 0.5 # [-10, 10] -> [0, 1]
    normalizedY = y / 20 + 0.5

    center = int(normalizedX * 25)
    spread = int(normalizedY * 12) + 1

    lowRange = max(0, center - spread)
    highRange = min(len(letters) - 1, center + spread)
    return letters[random.randint(lowRange, highRange)]
