function handler () {
    EVENT_DATA=$1
    DEFAULT_COMPILER=$(curl -s https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/linux-amd64/solc-linux-amd64-latest)
    GIVEN_COMPILER=`echo $EVENT_DATA | ./jq -r .queryStringParameters.compiler`
    RESPONSE_HEADERS='{"content-type":"application/json"}'
    RESPONSE_FILE="$(mktemp)"
    if [ $GIVEN_COMPILER = null ] 
    then
        GIVEN_COMPILER=$DEFAULT_COMPILER
    else
        GIVEN_COMPILER="solc-linux-amd64-$GIVEN_COMPILER"
    fi
    result=`curl --silent https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/linux-amd64/$GIVEN_COMPILER --output /tmp/solc`
    SOLC_SIZE=`wc -c /tmp/solc | awk '{print $1}'`
    if [[ $SOLC_SIZE -lt 100 ]]; then
        BODY=`echo '{"errors":[{"message":"Given compiler not found"}]}' | ./jq tostring`
        echo "{\"statusCode\":200,\"body\":$BODY,\"headers\":$RESPONSE_HEADERS}" > $RESPONSE_FILE
        echo $RESPONSE_FILE
        exit 0
    fi
    chmod +x /tmp/solc
    # RESPONSE="{\"statusCode\": 200, \"body\": \"Hello from Lambda3!\"}"
    # RESPONSE_FILE="$(mktemp)"
    # echo $RESPONSE > $RESPONSE_FILE
    # echo $RESPONSE_FILE


    OUTPUT=`echo $EVENT_DATA | ./jq -r .body | /tmp/solc --standard-json | ./jq '.'`
    BODY=`echo "{\"compiler\":\"$GIVEN_COMPILER\",\"output\":$OUTPUT}" | ./jq tostring`
    RESPONSE="{\"statusCode\": 200, \"body\":$BODY,\"headers\":$RESPONSE_HEADERS}"
    echo $RESPONSE > $RESPONSE_FILE
    echo $RESPONSE_FILE
}
