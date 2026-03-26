#!/bin/bash
# Keep Moodle's public URL aligned with the deployment path on every start.

set -o errexit
set -o nounset
set -o pipefail

. /opt/bitnami/scripts/moodle-env.sh
. /opt/bitnami/scripts/libmoodle.sh

if [[ ! -f "/bitnami/moodle/.user_scripts_initialized" && -d "/docker-entrypoint-init.d" ]]; then
    read -r -a init_scripts <<< "$(find "/docker-entrypoint-init.d" -type f -print0 | sort -z | xargs -0)"
    if [[ "${#init_scripts[@]}" -gt 0 ]] && [[ ! -f "/bitnami/moodle/.user_scripts_initialized" ]]; then
        mkdir -p "/bitnami/moodle"
        for init_script in "${init_scripts[@]}"; do
            for init_script_type_handler in /post-init.d/*.sh; do
                "$init_script_type_handler" "$init_script"
            done
        done
    fi

    touch "/bitnami/moodle/.user_scripts_initialized"
fi

if [[ -f "${MOODLE_CONF_FILE:-/bitnami/moodle/config.php}" ]]; then
    sed -i '/^\$CFG->reverseproxy = true;$/d;/^\$CFG->sslproxy = true;$/d' "$MOODLE_CONF_FILE"

    if [[ -n "${MOODLE_WWWROOT:-}" ]]; then
        escaped_wwwroot="${MOODLE_WWWROOT//&/\\&}"
        sed -i "s#\\\$CFG->wwwroot   = .*#\\\$CFG->wwwroot   = '${escaped_wwwroot}';#g" "$MOODLE_CONF_FILE"
    else
        moodle_configure_wwwroot
    fi

    # The Bitnami entrypoint and root-run CLI tasks can leave writable cache
    # trees owned by root on persisted volumes. Moodle then fails when Apache's
    # daemon user needs to create new cache directories or lock files.
    writable_moodledata_dirs=(
        /bitnami/moodledata/cache
        /bitnami/moodledata/localcache
        /bitnami/moodledata/muc
        /bitnami/moodledata/sessions
        /bitnami/moodledata/temp
        /bitnami/moodledata/trashdir
    )
    for moodledata_dir in "${writable_moodledata_dirs[@]}"; do
        if [[ -d "${moodledata_dir}" ]]; then
            chown -R daemon:daemon "${moodledata_dir}"
        fi
    done
    chown daemon:root /bitnami/moodledata
    chmod 775 /bitnami/moodledata

    if [[ -n "${MOODLE_FILE_LOCK_ROOT:-}" ]]; then
        mkdir -p "${MOODLE_FILE_LOCK_ROOT}"
        chown daemon:root "${MOODLE_FILE_LOCK_ROOT}"
        chmod 2775 "${MOODLE_FILE_LOCK_ROOT}"
        escaped_lock_root="${MOODLE_FILE_LOCK_ROOT//&/\\&}"

        if grep -q '^\$CFG->file_lock_root = ' "$MOODLE_CONF_FILE"; then
            sed -i "s#\\\$CFG->file_lock_root = .*#\\\$CFG->file_lock_root = '${escaped_lock_root}';#g" "$MOODLE_CONF_FILE"
        else
            sed -i "/^require_once/i \\\$CFG->file_lock_root = '${escaped_lock_root}';" "$MOODLE_CONF_FILE"
        fi
    fi

    moodle_configure_reverseproxy
fi
