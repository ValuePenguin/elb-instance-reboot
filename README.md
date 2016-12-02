# elb-instance-reboot

An AWS lambda function that reboots ELB instances that are out of service.
The function can be automatically triggered by a CloudWatch alarm via
an SNS topic message.

## Prerequisites

* AWS account with access to: IAM, Lambda, SNS, CloudWatch, ELB, and EC2

The following installed on your local machine (for deployment):

* [Node (with NPM) Installed](https://docs.npmjs.com/getting-started/installing-node)
* [Claudia NPM package](https://www.npmjs.com/package/claudia) `npm install -g claudia`
* [AWS CLI Installed](http://docs.aws.amazon.com/cli/latest/userguide/installing.html)
* [AWS CLI credentials configured](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html) Just run `aws configure`

## Deployment and Configuration

To deploy and configure the lambda function, run the following commands from the top-level project directory.

### Step 1: Deploy the lambda function

Substitute the region of your elb for {region}, e.g. `us-west-2`

(*Note*: AWS calls often take a few seconds to return. So we need to
bump the lambda function timeout to 60 seconds.)

```
claudia create --handler elb-instance-reboot.handler --policies policies --timeout 60 --region {region}
```

### Step 2: Create an SNS Topic

```
aws sns create-topic --name elb-unhealthy-instances
```

### Step 3: Subscribe the lambda function to the SNS Topic

Use the `TopicArn` value returned from the last step for {topic}. It
will be in the form `arn:aws:sns:{region}:{owner id}:elb-unhealthy-instances`

```
claudia add-sns-event-source --topic {topic}
```

### Step 4: Configure a CloudWatch alarm

The following command will create a CloudWatch alarm that is triggered when
one or more EC2 instances are out of service for more than 1 minute. You can
alter the values for threshold, period, and evaluation-periods to suit your needs.

Substitute the name of the load balancer you want to monitor for {elb name}.
Substitute the `TopicArn` value from step 3 for {topic}.

```
aws cloudwatch put-metric-alarm --alarm-name unhealthy-instances \
 --metric-name UnHealthyHostCount \
 --namespace AWS/ELB \
 --statistic Minimum \
 --period 60 \
 --threshold 1 \
 --comparison-operator GreaterThanOrEqualToThreshold \
 --evaluation-periods 1 \
 --alarm-actions {topic} \
 --dimensions "Name=LoadBalancerName,Value={elb name}"
```

If you have multiple load balancers that you want to monitor, set a separate alarm
for each one. These alarms can all point to the same SNS Topic and utilize the same
lambda function.

## Test

You can confirm that the service is working by manually taking one of your EC2 instances out of service, e.g.
by logging in and killing the service that responds to the healthcheck endpoint.

You can also test your function manually by going to Lambda -> Functions -> Test and using data
like below:

```json
{
  "Records": [
    {
      "EventVersion": "1.0",
      "EventSubscriptionArn": "arn:aws:sns:EXAMPLE",
      "EventSource": "aws:sns",
      "Sns": {
        "SignatureVersion": "1",
        "Timestamp": "1970-01-01T00:00:00.000Z",
        "Signature": "EXAMPLE",
        "SigningCertUrl": "EXAMPLE",
        "MessageId": "95df01b4-ee98-5cb9-9903-4c221d41eb5e",
        "Message": "{\r\n      \"AlarmName\":\"unhealthy-instances\",\r\n      \"AlarmDescription\":null,\r\n      \"AWSAccountId\":\"873036857774\",\r\n      \"NewStateValue\":\"ALARM\",\r\n      \"NewStateReason\":\"Threshold Crossed: 1 datapoint (3.0) was greater than or equal to the threshold (1.0).\",\r\n      \"StateChangeTime\":\"2016-12-02T18:11:06.301+0000\",\r\n      \"Region\":\"US East - N. Virginia\",\r\n      \"OldStateValue\":\"OK\",\r\n      \"Trigger\":{\r\n         \"MetricName\":\"UnHealthyHostCount\",\r\n         \"Namespace\":\"AWS\/ApplicationELB\",\r\n         \"Statistic\":\"MINIMUM\",\r\n         \"Unit\":null,\r\n         \"Dimensions\":[\r\n            {\r\n               \"name\":\"LoadBalancer\",\r\n               \"value\":\"app\/prod\/9eb8655e4bb723ec\"\r\n            },\r\n            {\r\n               \"name\":\"TargetGroup\",\r\n               \"value\":\"targetgroup\/prod\/16607dc38818fd0e\"\r\n            }\r\n         ],\r\n         \"Period\":60,\r\n         \"EvaluationPeriods\":1,\r\n         \"ComparisonOperator\":\"GreaterThanOrEqualToThreshold\",\r\n         \"Threshold\":1.0\r\n      }\r\n   }",
        "MessageAttributes": {
          "Test": {
            "Type": "String",
            "Value": "TestString"
          },
          "TestBinary": {
            "Type": "Binary",
            "Value": "TestBinary"
          }
        },
        "Type": "Notification",
        "UnsubscribeUrl": "EXAMPLE",
        "TopicArn": "arn:aws:sns:EXAMPLE",
        "Subject": "TestInvoke"
      }
    }
  ]
}
```

The important part of testing manually is the message which needs to be an escaped JSON string.

## Monitoring

You can subscribe to the SNS topic via email to be notified when the alarm is triggered.

To see the results of any executions of the lambda function, look at the /aws/lambda/elb-instance-reboot log group
under Cloudwatch Logs.


