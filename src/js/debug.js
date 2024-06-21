function dbp(string, delimChar = '\u2501') {
    const strLen = string.length;
    const remainingChars = (debugStringLength - strLen)/2;
    let printed = delimChar+delimChar;
    if (string.length > 0) {
        printed = ' ' + string + ' ';
    }
    const dbString = delimChar.repeat(Math.ceil(remainingChars)) + printed + delimChar.repeat(Math.floor(remainingChars));
    console.log(dbString);
}

function dbt(objectToTrim) {
    const string = objectToTrim.toString();
    return string.substring(0, debugTrimStringLength);
}