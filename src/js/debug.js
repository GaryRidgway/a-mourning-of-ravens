function dbp(string) {
    const strLen = string.length;
    const remainingChars = (debugStringLength - strLen)/2;
    const dbString = '_'.repeat(Math.ceil(remainingChars)) + ' ' + string + ' ' + '_'.repeat(Math.floor(remainingChars));
    console.log(dbString);
}