#!/bin/bash
#set -eux
#===================================================================================================
# build in-house
#===================================================================================================
#---------------------------------------------------------------------------------------------------
# env
#---------------------------------------------------------------------------------------------------
readonly DIR_SCRIPT="$(dirname $0)"
cd "$(cd ${DIR_SCRIPT}; cd ..; pwd)" || exit 6

readonly DIR_BASE="$(pwd)"
readonly DIR_DIST="${DIR_BASE}/dist"
readonly DIR_ARCHIVE_DIST="${DIR_BASE}/dist_archive"

readonly PRODUCT="in-house-swagger-editor"
readonly VERSION=$(                                                                                \
  cat package.json                                                                                 |
  grep '  "version":'                                                                              |
  sed -e 's|^ *||'                                                                                 |
  cut -d ' ' -f 2                                                                                  |
  sed -e 's|"||g'                                                                                  |
  sed -e 's|,$||'                                                                                  \
)

readonly USAGE="Usage: $(basename $0) [-s]"

readonly ARCHIVE_NAME="${PRODUCT}-${VERSION}"
readonly DIR_ARCHIVE="${DIR_ARCHIVE_DIST}/${ARCHIVE_NAME}"


#---------------------------------------------------------------------------------------------------
# option
#---------------------------------------------------------------------------------------------------
isSkipNpmBuild=false

while :; do
  case $1 in
    -s|--skip-npm-build)
      isSkipNpmBuild=true
      break
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "${USAGE}" 1>&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done


#---------------------------------------------------------------------------------------------------
# build
#---------------------------------------------------------------------------------------------------
if [[ "${isSkipNpmBuild}" != "true" ]]; then
  echo ""
  echo "npm run build"
  npm run build
  retcode=$?
  if [[ ${retcode} -ne 0 ]]; then
    echo "error occured in npm run build process." >&2
    exit 1
  fi
fi


#---------------------------------------------------------------------------------------------------
# create archive
#---------------------------------------------------------------------------------------------------
echo "init archive dir"
if [[ -d "${DIR_ARCHIVE}" ]]; then
  rm -fr "${DIR_ARCHIVE}"
fi
mkdir -p "${DIR_ARCHIVE}/dist"

echo ""
echo "create archive"
cp -p ./index.html "${DIR_ARCHIVE}/"
cp -p "${DIR_DIST}"/* "${DIR_ARCHIVE}/dist/"
cd "${DIR_ARCHIVE_DIST}"
tar czf ./${ARCHIVE_NAME}.tar.gz ./${ARCHIVE_NAME}
md5sum  ./${ARCHIVE_NAME}.tar.gz | cut -d ' ' -f 1 > ./${ARCHIVE_NAME}.tar.gz.md5


echo ""
echo "remove archive dir"
rm -fr "${DIR_ARCHIVE:?}/"

exit 0
