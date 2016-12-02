const AWS = require('aws-sdk');
const waterfall = require('async-waterfall');

exports.handler = function(event, context, callback) {

  console.log('event: ', JSON.stringify(event));
  const message = JSON.parse(event.Records[0].Sns.Message);
  console.log('message: ', JSON.stringify(message));
  const targetGroup = (message.Trigger && message.Trigger.Dimensions) ? message.Trigger.Dimensions[1] : null;
  console.log('targetGroup: ', JSON.stringify(targetGroup));

  if (!targetGroup) return console.log('No TargetGroup value found in message', message);
  const targetGroupName = targetGroup.value.match(/^targetgroup\/(.*)\//)
    ? targetGroup.value.match(/^targetgroup\/(.*)\//)[1]
    : null;
  if (!targetGroupName) return console.log('Malformed TargetGroup value found in message', targetGroup);
  console.log('targetGroupName', targetGroupName);

  const elbApi = new AWS.ELBv2();
  const ec2Api = new AWS.EC2();

  waterfall([
    function(next) {
      const params = {
        Names: [targetGroupName]
      };
      elbApi.describeTargetGroups(params, next);
    },
    function(data, next) {
      console.log('describeTargetGroups: ', JSON.stringify(data));
      const params = {
        TargetGroupArn: data.TargetGroups[0].TargetGroupArn
      }
      elbApi.describeTargetHealth(params, next);
    },
    function(data, next){
      console.log('describeTargetHealth: ', JSON.stringify(data));
      const unhealthyNodes = data.TargetHealthDescriptions
        .filter(instance => instance.TargetHealth.State == "unhealthy" && instance.TargetHealth.Reason != "Elb.InternalError")
        .map(instance => instance.Target.Id);
      console.log('unhealthyNodes', JSON.stringify(unhealthyNodes));
      if (unhealthyNodes.length) {
        if (unhealthyNodes.length > 1) {
          console.log('multiple instances unhealthy but will only reboot one');
        }
        console.log('rebooting instance', unhealthyNodes[0]);
        ec2Api.rebootInstances({InstanceIds: [unhealthyNodes[0]]}, next);
      } else {
        console.log('no unhealthy nodes');
        next(null, 'All nodes healthy, no reboots necessary');
      }
    }
  ], function (err, result) {
      console.log('Process complete', result);
      callback(err, (err) ? 'Fail' : 'Success');
  });
};