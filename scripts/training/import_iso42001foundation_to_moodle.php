<?php

define('CLI_SCRIPT', true);

require('/opt/bitnami/moodle/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/mod/scorm/lib.php');
require_once($CFG->dirroot . '/mod/scorm/locallib.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->libdir . '/modinfolib.php');

global $DB, $USER;

$zipPath = $argv[1] ?? '/tmp/iso42001foundation-scorm.zip';
if (!is_file($zipPath)) {
    fwrite(STDERR, "SCORM zip not found at {$zipPath}\n");
    exit(1);
}

$courseShortnames = ['iso42001_foundation', 'iso42001foundation'];
$courseFullname = 'Managing AI Governance in Organizations with ISO/IEC 42001';
$scormName = 'ISO/IEC 42001 Foundation Training';

$admin = get_admin();
if (!$admin) {
    fwrite(STDERR, "Unable to resolve Moodle admin user.\n");
    exit(1);
}
$USER = $admin;

$course = null;
[$insql, $params] = $DB->get_in_or_equal($courseShortnames, SQL_PARAMS_NAMED);
$course = $DB->get_record_select('course', "shortname {$insql}", $params);
if (!$course) {
    $course = $DB->get_record('course', ['fullname' => $courseFullname]);
}
if (!$course) {
    $courseData = new stdClass();
    $courseData->fullname = $courseFullname;
    $courseData->shortname = $courseShortnames[0];
    $courseData->category = 1;
    $courseData->summary = 'LeadAI Academy course for ISO/IEC 42001 executive training.';
    $courseData->summaryformat = FORMAT_HTML;
    $courseData->format = 'topics';
    $courseData->numsections = 1;
    $courseData->enablecompletion = 1;
    $courseData->visible = 1;
    $course = create_course($courseData);
}

$scormModule = $DB->get_record('modules', ['name' => 'scorm'], '*', MUST_EXIST);

$existing = $DB->get_record('scorm', ['course' => $course->id, 'name' => $scormName]);
$status = 'created';
if ($existing) {
    $existingCm = get_coursemodule_from_instance('scorm', $existing->id, $course->id, false, MUST_EXIST);
    course_delete_module($existingCm->id);
    rebuild_course_cache($course->id, true);
    $status = 'recreated';
}

$cfgscorm = get_config('scorm');
$usercontext = context_user::instance($USER->id);
$draftitemid = file_get_unused_draft_itemid();

$fs = get_file_storage();
$filerecord = [
    'component' => 'user',
    'filearea' => 'draft',
    'contextid' => $usercontext->id,
    'itemid' => $draftitemid,
    'filepath' => '/',
    'filename' => basename($zipPath),
];
$fs->create_file_from_pathname($filerecord, $zipPath);

$moduleinfo = new stdClass();
$moduleinfo->course = $course->id;
$moduleinfo->module = $scormModule->id;
$moduleinfo->modulename = 'scorm';
$moduleinfo->name = $scormName;
$moduleinfo->intro = 'LeadAI Academy SCORM package for ISO/IEC 42001 foundation training.';
$moduleinfo->introformat = FORMAT_HTML;
$moduleinfo->section = 0;
$moduleinfo->visible = 1;
$moduleinfo->visibleoncoursepage = 1;
$moduleinfo->groupmode = 0;
$moduleinfo->groupingid = 0;
$moduleinfo->completion = COMPLETION_TRACKING_AUTOMATIC;
$moduleinfo->completionview = 0;
$moduleinfo->completionexpected = 0;
$moduleinfo->completionpassgrade = 0;
$moduleinfo->completiongradeitemnumber = null;
$moduleinfo->showdescription = 0;

$moduleinfo->scormtype = SCORM_TYPE_LOCAL;
$moduleinfo->packagefile = $draftitemid;
$moduleinfo->packageurl = '';
$moduleinfo->updatefreq = SCORM_UPDATE_NEVER;
$moduleinfo->popup = 0;
$moduleinfo->width = $cfgscorm->framewidth;
$moduleinfo->height = $cfgscorm->frameheight;
$moduleinfo->skipview = $cfgscorm->skipview;
$moduleinfo->hidebrowse = $cfgscorm->hidebrowse;
$moduleinfo->displaycoursestructure = $cfgscorm->displaycoursestructure;
$moduleinfo->hidetoc = $cfgscorm->hidetoc;
$moduleinfo->nav = $cfgscorm->nav;
$moduleinfo->navpositionleft = $cfgscorm->navpositionleft;
$moduleinfo->navpositiontop = $cfgscorm->navpositiontop;
$moduleinfo->displayattemptstatus = $cfgscorm->displayattemptstatus;
$moduleinfo->timeopen = 0;
$moduleinfo->timeclose = 0;
$moduleinfo->grademethod = $cfgscorm->grademethod;
$moduleinfo->maxgrade = 100;
$moduleinfo->maxattempt = $cfgscorm->maxattempt;
$moduleinfo->whatgrade = $cfgscorm->whatgrade;
$moduleinfo->forcenewattempt = $cfgscorm->forcenewattempt;
$moduleinfo->lastattemptlock = $cfgscorm->lastattemptlock;
$moduleinfo->forcecompleted = $cfgscorm->forcecompleted;
$moduleinfo->masteryoverride = $cfgscorm->masteryoverride;
$moduleinfo->auto = $cfgscorm->auto;
$moduleinfo->autocommit = $cfgscorm->autocommit;
$moduleinfo->completionstatusrequired = 6;
$moduleinfo->completionscorerequired = 80;
$moduleinfo->completionstatusallscos = 0;

$result = add_moduleinfo($moduleinfo, $course);

echo json_encode([
    'status' => $status,
    'courseid' => (int)$course->id,
    'coursemoduleid' => (int)$result->coursemodule,
    'courseurl' => "{$CFG->wwwroot}/course/view.php?id={$course->id}",
], JSON_PRETTY_PRINT) . PHP_EOL;
